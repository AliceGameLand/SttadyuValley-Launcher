const fs = require('node:fs/promises')
const path = require('node:path')
const { randomUUID } = require('node:crypto')
const nbt = require('nbtify')

async function ensureServerEntry(directory, { name, address }){
    const file = path.join(directory, 'servers.dat')
    const existing = await fs.readFile(file).catch(error => {
        if(error.code !== 'ENOENT') throw error
        return null
    })
    const document = existing
        ? await nbt.read(existing, { endian: 'big' })
        : new nbt.NBTData({ servers: [] })
    const entries = document.data.servers
    if(!Array.isArray(entries) || entries.some(entry => typeof entry?.ip !== 'string')){
        throw new Error('Invalid Minecraft server list')
    }
    const server = entries.find(entry => entry.name === name)
        ?? entries.find(entry => entry.ip === address)
    if(server?.name === name && server.ip === address && !Number(server.hidden)) return
    if(server){
        Object.assign(server, { name, ip: address })
        if(Number(server.hidden)) delete server.hidden
    } else {
        entries.push({ name, ip: address })
    }

    const data = await nbt.write(document)
    const temporary = file + '.' + randomUUID() + '.tmp'
    try {
        await fs.writeFile(temporary, data, { flag: 'wx' })
        await fs.rename(temporary, file)
    } finally {
        await fs.rm(temporary, { force: true })
    }
}

exports.ensureServerEntry = ensureServerEntry
