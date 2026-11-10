const { execFile } = require('node:child_process')
const { createHash } = require('node:crypto')
const { promisify } = require('node:util')
const path = require('node:path')
const fs = require('fs-extra')

const run = promisify(execFile)
const version = '1.20.1-47.4.0'

function libraryPath(commonDirectory, artifactPath) {
    return path.join(commonDirectory, 'libraries', artifactPath)
}

async function prepareBundledInstaller(target, artifact, resources = process.resourcesPath) {
    async function matches(file) {
        const stat = await fs.stat(file).catch(error => {
            if(error.code !== 'ENOENT') throw error
            return null
        })
        if(!stat?.isFile() || stat.size !== artifact.size) return false
        const hash = createHash('md5')
        for await(const bytes of fs.createReadStream(file)) hash.update(bytes)
        return hash.digest('hex') === artifact.MD5
    }

    if(await matches(target)) return
    const source = path.join(resources, 'forge', path.basename(target))
    const staged = target + '.bundled'
    await fs.ensureDir(path.dirname(target))
    try {
        await fs.copyFile(source, staged)
        if(!await matches(staged)) throw new Error('내장 Forge 설치파일의 체크섬이 다릅니다.')
        await fs.rename(staged, target)
    } finally {
        await fs.remove(staged)
    }
}

async function ensureInstalled(commonDirectory, installer, manifest, javaw) {
    const patched = libraryPath(commonDirectory, `net/minecraftforge/forge/${version}/forge-${version}-client.jar`)
    const universal = libraryPath(commonDirectory, 'net/minecraftforge/forge/' + version + '/forge-' + version + '-universal.jar')
    const extra = libraryPath(commonDirectory, 'net/minecraft/client/1.20.1-20230612.114412/client-1.20.1-20230612.114412-extra.jar')
    const paths = [patched, universal, extra, ...manifest.libraries.map(lib => libraryPath(commonDirectory, lib.downloads.artifact.path))]
    async function complete() {
        const files = await Promise.all(paths.map(file => fs.stat(file).catch(error => {
            if(error.code !== 'ENOENT') throw error
            return null
        })))
        return files.every(file => file?.isFile() && file.size > 0)
    }

    if(await complete()) return
    const profiles = path.join(commonDirectory, 'launcher_profiles.json')
    await fs.outputJson(profiles, { profiles: {}, settings: {}, version: 3 }, { flag: 'wx' }).catch(error => {
        if(error.code !== 'EEXIST') throw error
    })
    const java = path.join(path.dirname(javaw), 'java.exe')
    await run(java, ['-jar', installer, '--installClient', commonDirectory], {
        cwd: commonDirectory,
        windowsHide: true,
        maxBuffer: 8 * 1024 * 1024,
        timeout: 10 * 60 * 1000
    })
    if(!await complete()) throw new Error('Forge 47.4.0 설치 파일을 찾을 수 없습니다.')
}

exports.prepareBundledInstaller = prepareBundledInstaller
exports.ensureInstalled = ensureInstalled
