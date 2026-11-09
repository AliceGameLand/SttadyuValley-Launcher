const { createHash } = require('node:crypto')
const { createReadStream } = require('node:fs')
const fs = require('fs-extra')
const path = require('node:path')
const AdmZip = require('adm-zip')
const got = require('got')
const pack = require('../config/sunlit-lock.json')

const marker = '.sunlit-pack.json'
const overrideFolders = new Set(['config', 'configureddefaults', 'defaultconfigs', 'kubejs', 'patchouli_books', 'resourcepacks', 'shaderpacks'])
const activeImports = new Set()

function prismDefault() {
    return path.join(process.env.APPDATA ?? '', 'PrismLauncher', 'instances', 'Society- Sunlit Valley')
}

function isReady(destination) {
    try {
        return fs.readJsonSync(path.join(destination, marker)).archive === pack.archiveSha256
    } catch {
        return false
    }
}

async function inspectPrism(selected) {
    const root = /^(?:\.minecraft|minecraft)$/i.test(path.basename(selected)) ? path.dirname(selected) : selected
    const components = await fs.readJson(path.join(root, 'mmc-pack.json')).catch(() => null)
    const cfg = await fs.readFile(path.join(root, 'instance.cfg'), 'utf8').catch(() => '')
    const flame = await fs.readJson(path.join(root, 'flame/manifest.json')).catch(() => null)
    const versionMatches = flame?.version === pack.version || /^ManagedPackVersionID=8980840\s*$/m.test(cfg)
    if (!versionMatches
        || !components?.components?.some(entry => entry.uid === 'net.minecraft' && entry.version === pack.minecraft)
        || !components.components.some(entry => entry.uid === 'net.minecraftforge' && `forge-${entry.version}` === pack.forge)) {
        throw new Error('Prism에서 Society: Sunlit Valley 4.1.5A 인스턴스 폴더를 선택해 주세요.')
    }
    for (const name of ['minecraft', '.minecraft']) {
        const game = path.join(root, name)
        if ((await fs.lstat(game).catch(() => null))?.isDirectory()) return fs.realpath(game)
    }
    throw new Error('선택한 Prism 인스턴스에 게임 폴더가 없습니다.')
}

async function matches(file, sha1) {
    if (!(await fs.lstat(file).catch(() => null))?.isFile()) return false
    const hash = createHash('sha1')
    for await (const chunk of createReadStream(file)) hash.update(chunk)
    return hash.digest('hex') === sha1
}

async function matchAsset(game, asset, names) {
    const requested = path.join(game, asset.path)
    if (await matches(requested, asset.sha1)) return requested
    const folder = path.dirname(asset.path)
    const ext = path.extname(asset.path)
    const stem = path.basename(asset.path, ext)
    const alternatives = names.get(folder).filter(name =>
        name.startsWith(stem) && /^\s*\(\d+\)$/.test(name.slice(stem.length, -ext.length)) && name.endsWith(ext))
    for (const name of alternatives) {
        const candidate = path.join(game, folder, name)
        if (await matches(candidate, asset.sha1)) return candidate
    }
    return null
}

async function loadOverrides() {
    const response = await got(pack.archiveUrl, { responseType: 'buffer', timeout: { request: 90000 }, retry: { limit: 1 } })
    if (createHash('sha256').update(response.body).digest('hex') !== pack.archiveSha256) {
        throw new Error('CurseForge에서 받은 4.1.5A 설정 파일의 체크섬이 다릅니다.')
    }
    return response.body
}

async function stageOverrides(archive, staging, assets) {
    if (createHash('sha256').update(archive).digest('hex') !== pack.archiveSha256) {
        throw new Error('Sunlit Valley 설정 압축파일을 검증하지 못했습니다.')
    }
    for (const entry of new AdmZip(archive).getEntries()) {
        const [root, folder, ...segments] = entry.entryName.split('/')
        if (entry.isDirectory || root !== 'overrides' || !overrideFolders.has(folder)
            || !segments.length || segments.some(part => !part || part === '.' || part === '..' || /[\\:]/.test(part))
            || segments.at(-1) === 'servers.dat') continue
        const relative = [folder, ...segments].join('/')
        if (assets.has(relative)) continue
        await fs.outputFile(path.join(staging, relative), entry.getData())
    }
    const defaultOptions = path.join(staging, 'configureddefaults/options.txt')
    if (await fs.pathExists(defaultOptions)) await fs.copyFile(defaultOptions, path.join(staging, 'options.txt'))
}

// Keep configuration changes from the new launcher. Refresh only the three pack asset folders.
async function mergeStaged(staging, destination) {
    await fs.ensureDir(destination)
    if (!(await fs.lstat(destination)).isDirectory()) throw new Error('게임 폴더가 일반 폴더가 아닙니다.')
    await fs.remove(path.join(destination, marker))
    async function merge(relative) {
        for (const entry of await fs.readdir(path.join(staging, relative), { withFileTypes: true })) {
            const child = path.join(relative, entry.name)
            const target = path.join(destination, child)
            const current = await fs.lstat(target).catch(error => {
                if (error.code !== 'ENOENT') throw error
                return null
            })
            if (entry.isDirectory()) {
                if (current && !current.isDirectory()) throw new Error(`게임 폴더를 확인해 주세요. ${child}`)
                await fs.ensureDir(target)
                await merge(child)
            } else if (!current || ['mods', 'resourcepacks', 'shaderpacks'].includes(relative)) {
                if (current && !current.isFile()) throw new Error(`게임 파일을 확인해 주세요. ${child}`)
                await fs.rename(path.join(staging, child), target)
            }
        }
    }
    await merge('')
    await fs.outputJson(path.join(staging, marker), { version: pack.version, archive: pack.archiveSha256 })
    await fs.rename(path.join(staging, marker), path.join(destination, marker))
}

async function importPack(selected, destination, onProgress = () => {}, getOverrides = loadOverrides) {
    const key = path.resolve(destination).toLowerCase()
    if (activeImports.has(key)) throw new Error('이미 모드팩을 가져오는 중입니다.')
    activeImports.add(key)
    let staging
    try {
        const game = await inspectPrism(selected)
        const source = game.toLowerCase()
        if (key === source || key.startsWith(source + path.sep) || source.startsWith(key + path.sep)) {
            throw new Error('Prism 폴더와 새 게임 폴더는 서로 분리되어 있어야 합니다.')
        }
        const names = new Map()
        for (const folder of ['mods', 'resourcepacks', 'shaderpacks']) {
            const dir = path.join(game, folder)
            const stat = await fs.lstat(dir).catch(() => null)
            if (stat && !stat.isDirectory()) throw new Error(`Prism의 ${folder} 폴더를 확인해 주세요.`)
            names.set(folder, stat ? await fs.readdir(dir) : [])
        }
        const found = []
        const missing = []
        for (const [i, asset] of pack.files.entries()) {
            const file = await matchAsset(game, asset, names)
            if (file) found.push([asset, file])
            else missing.push(asset)
            if (i % 12 === 0) onProgress('verify', i, pack.files.length)
        }
        if (missing.length) {
            const error = new Error('아래 파일을 Prism의 해당 폴더에 넣고 다시 가져와 주세요.')
            error.missing = missing
            throw error
        }

        onProgress('defaults')
        const archive = await getOverrides()
        await fs.ensureDir(path.dirname(destination))
        staging = await fs.mkdtemp(path.join(path.dirname(destination), '.sunlit-import-'))
        await stageOverrides(archive, staging, new Set(pack.files.map(asset => asset.path)))
        for (const [i, [asset, file]] of found.entries()) {
            const target = path.join(staging, asset.path)
            await fs.ensureDir(path.dirname(target))
            await fs.copyFile(file, target)
            if (!await matches(target, asset.sha1)) throw new Error(`복사 중 파일이 바뀌었습니다. ${asset.path}`)
            if (i % 12 === 0) onProgress('copy', i, found.length)
        }
        await mergeStaged(staging, destination)
    } finally {
        try {
            if (staging) await fs.remove(staging)
        } finally {
            activeImports.delete(key)
        }
    }
}

module.exports = { importPack, inspectPrism, isReady, prismDefault }
