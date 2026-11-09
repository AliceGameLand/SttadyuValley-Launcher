const fs = require('fs-extra')
const got = require('got')
const AdmZip = require('adm-zip')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const officialWallpaper = 'https://www.minecraft.net/content/dam/minecraftnet/games/minecraft/software/wallpapers_minecraft_village_pillage.zip?download=true'

function localFile(directory) {
    return path.join(directory, 'village-pillage.png')
}

function localUrl(directory) {
    const file = localFile(directory)
    return fs.existsSync(file) ? pathToFileURL(file).href : null
}

async function install(directory) {
    const { body } = await got(officialWallpaper, {
        headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/142.0.0.0 Safari/537.36' },
        responseType: 'buffer', timeout: { request: 20000 }, retry: { limit: 1 }
    })
    const data = new AdmZip(body).getEntry('wallpaper_minecraft_village_pillage_1920x1080.png')?.getData()
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
exports.reset = directory => fs.remove(localFile(directory))
