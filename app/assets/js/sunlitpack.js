const { createHash } = require('node:crypto')
const { createReadStream } = require('node:fs')
const fs = require('fs-extra')
const path = require('node:path')
const AdmZip = require('adm-zip')
const got = require('got')
const { downloadFile } = require('./reliabledownload')
const pack = require('../config/sunlit-lock.json')

const marker = '.sunlit-pack.json'
const overrideFolders = new Set(['config', 'configureddefaults', 'defaultconfigs', 'kubejs', 'patchouli_books', 'resourcepacks'])
const activeInstalls = new Set()

function isReady(destination) {
    try {
        return fs.readJsonSync(path.join(destination, marker)).archive === pack.archiveSha256
    } catch {
        return false
    }
}

async function matches(file, sha1) {
    if (!(await fs.lstat(file).catch(() => null))?.isFile()) return false
    const hash = createHash('sha1')
    for await (const chunk of createReadStream(file)) hash.update(chunk)
    return hash.digest('hex') === sha1
}

function assetUrl(asset) {
    const directory = Math.floor(asset.fileId / 1000) + '/' + asset.fileId % 1000
    return 'https://mediafilez.forgecdn.net/files/' + directory + '/' + encodeURIComponent(path.basename(asset.path))
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
            if (!relative && entry.name === marker) continue
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

async function installPack(destination, onProgress = () => {}, fetchAsset = downloadFile, getOverrides = loadOverrides) {
    const key = path.resolve(destination).toLowerCase()
    if (activeInstalls.has(key)) throw new Error('이미 모드팩을 준비하는 중입니다.')
    activeInstalls.add(key)
    const staging = destination + '.pack-staging'
    try {
        await fs.ensureDir(staging)
        if (!(await fs.lstat(staging)).isDirectory()) throw new Error('모드팩 임시 폴더를 확인해 주세요.')
        const assets = pack.files.filter(asset => /^(mods|resourcepacks)\/[^/\\:]+$/.test(asset.path))
        if (assets.length !== pack.files.length) throw new Error('모드팩 파일 목록이 올바르지 않습니다.')

        let next = 0
        let done = 0
        const failed = []
        onProgress('download', 0, assets.length)
        await Promise.all(Array.from({ length: 8 }, async () => {
            while (next < assets.length) {
                const asset = assets[next++]
                const target = path.join(staging, asset.path)
                try {
                    if (!await matches(target, asset.sha1) && !await matches(path.join(destination, asset.path), asset.sha1)) {
                        await fetchAsset(assetUrl(asset), target)
                        if (!await matches(target, asset.sha1)) {
                            await fs.remove(target)
                            throw new Error('다운로드한 파일의 체크섬이 다릅니다.')
                        }
                    }
                    onProgress('download', ++done, assets.length)
                } catch (error) {
                    failed.push({ path: asset.path, message: error.message })
                }
            }
        }))
        if (failed.length) {
            const error = new Error('모드팩 파일 ' + failed.length + '개를 준비하지 못했습니다.')
            error.missing = failed
            throw error
        }

        onProgress('defaults')
        await stageOverrides(await getOverrides(), staging, new Set(assets.map(asset => asset.path)))
        await mergeStaged(staging, destination)
        await fs.remove(staging).catch(() => {})
    } finally {
        activeInstalls.delete(key)
    }
}

async function prepareDonationResources(destination) {
    const installed = path.join(destination, '.sttadyu-donation-resources-v1')
    const name = 'SunlitDonationResources.zip'
    const target = path.join(destination, 'resourcepacks', name)
    if (await fs.pathExists(installed) && await fs.pathExists(target)) return
    await fs.copy(path.join(__dirname, '..', 'config', name), target)
    for (const relative of ['options.txt', 'configureddefaults/options.txt']) {
        const file = path.join(destination, relative)
        if (!await fs.pathExists(file)) continue
        const source = await fs.readFile(file, 'utf8')
        const updated = source.replace(/^resourcePacks:([^\r\n]*)/m, (line, json) => {
            try {
                const packs = JSON.parse(json)
                if (!Array.isArray(packs) || packs.includes('file/' + name)) return line
                return 'resourcePacks:' + JSON.stringify([...packs, 'file/' + name])
            } catch {
                return line
            }
        })
        if (source !== updated) await fs.writeFile(file, updated)
    }
    await fs.outputFile(installed, '')
}

module.exports = { installPack, isReady, prepareDonationResources }
