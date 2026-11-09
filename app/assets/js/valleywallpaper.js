const fs = require('fs-extra')
const got = require('got')
const AdmZip = require('adm-zip')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const officialWallpaper = 'https://www.minecraft.net/content/dam/minecraftnet/games/minecraft/software/wallpapers_minecraft_buzzybees.zip?download=true'

function localFile(directory) {
    return path.join(directory, 'buzzy-bees.png')
}

function localUrl(directory) {
    const file = localFile(directory)
    return fs.existsSync(file) ? pathToFileURL(file).href : null
}

async function install(directory, timeout = 20000, retries = 1) {
    const { body } = await got(officialWallpaper, {
        headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/142.0.0.0 Safari/537.36' },
        responseType: 'buffer', timeout: { request: timeout }, retry: { limit: retries }
    })
    const data = new AdmZip(body).getEntry('wallpaper_minecraft_buzzybees_1920x1080.png')?.getData()
    if (data?.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('공식 배경 이미지 파일을 찾지 못했습니다.')
    const destination = localFile(directory)
    const temporary = destination + '.download'
    try {
        await fs.outputFile(temporary, data)
        await fs.rename(temporary, destination)
    } finally {
        await fs.remove(temporary)
    }
}

exports.install = install
exports.localUrl = localUrl
const legacyFile = directory => path.join(directory, 'village-pillage.png')

// Refresh only profiles which already opted in to an official wallpaper.
exports.refreshLegacy = async function(directory) {
    if(!localUrl(directory) && await fs.pathExists(legacyFile(directory))) {
        await install(directory, 8000, 0)
    }
}

exports.reset = directory => Promise.all([fs.remove(localFile(directory)), fs.remove(legacyFile(directory))])
