const { execFile } = require('node:child_process')
const { promisify } = require('node:util')
const path = require('node:path')
const fs = require('fs-extra')

const run = promisify(execFile)
const version = '1.20.1-47.4.0'

function libraryPath(commonDirectory, artifactPath) {
    return path.join(commonDirectory, 'libraries', artifactPath)
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

exports.ensureInstalled = ensureInstalled
