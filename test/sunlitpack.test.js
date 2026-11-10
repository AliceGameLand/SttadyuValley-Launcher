const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const os = require('node:os')
const vm = require('node:vm')
const { createHash } = require('node:crypto')
const fs = require('fs-extra')
const AdmZip = require('adm-zip')

async function fixture(t){
    const base = await fs.mkdtemp(path.join(os.tmpdir(), 'sttadyu-pack-test-'))
    t.after(() => fs.remove(base))
    const destination = path.join(base, 'game')
    const zip = new AdmZip()
    zip.addFile('overrides/configureddefaults/options.txt', Buffer.from('resourcePacks:[]'))
    zip.addFile('overrides/configureddefaults/servers.dat', Buffer.from('ignore'))
    zip.addFile('overrides/kubejs/server_scripts/example.js', Buffer.from('pack default'))
    zip.addFile('overrides/saves/private/level.dat', Buffer.from('private'))
    const archive = zip.toBuffer()
    const contents = Buffer.from('test mod')
    const pack = {
        version: '4.1.5A', minecraft: '1.20.1', forge: 'forge-47.4.0',
        archiveSha256: createHash('sha256').update(archive).digest('hex'),
        files: [{ path: 'mods/farm.jar', fileId: 6782138, sha1: createHash('sha1').update(contents).digest('hex') }]
    }
    const source = await fs.readFile(path.join(__dirname, '../app/assets/js/sunlitpack.js'), 'utf8')
    const module = { exports: {} }
    vm.runInNewContext(source, {
        module, process, __dirname: path.join(__dirname, '../app/assets/js'), require: name => name === '../config/sunlit-lock.json' ? pack : name === '../config/donation-mod.json' ? require('../app/assets/config/donation-mod.json') : name === './reliabledownload' ? require('../app/assets/js/reliabledownload') : require(name)
    })
    return {
        destination, archive, ...module.exports,
        download: async (url, file) => {
            assert.equal(url, 'https://mediafilez.forgecdn.net/files/6782/138/farm.jar')
            await fs.outputFile(file, contents)
        }
    }
}

test('downloads verified files, retries setup and preserves player data', async t => {
    const f = await fixture(t)
    await assert.rejects(f.installPack(f.destination, undefined, async (_url, file) => fs.outputFile(file, 'corrupt'), async () => f.archive),
        error => error.missing[0].path === 'mods/farm.jar')
    assert.equal(f.isReady(f.destination), false)
    await assert.rejects(f.installPack(f.destination, undefined, f.download, async () => Buffer.alloc(0)), /검증/)
    assert.equal(f.isReady(f.destination), false)
    await f.installPack(f.destination, undefined, () => assert.fail('Verified files must be reused'), async () => f.archive)
    assert.equal(f.isReady(f.destination), true)
    assert.equal(await fs.readFile(path.join(f.destination, 'mods/farm.jar'), 'utf8'), 'test mod')
    assert.equal(await fs.readFile(path.join(f.destination, 'options.txt'), 'utf8'), 'resourcePacks:[]')
    for(const file of ['saves/private/level.dat', 'configureddefaults/servers.dat']){
        assert.equal(await fs.pathExists(path.join(f.destination, file)), false)
    }
    await fs.outputFile(path.join(f.destination, 'options.txt'), 'custom options')
    await fs.outputFile(path.join(f.destination, 'saves/new/level.dat'), 'new world')
    await f.installPack(f.destination, undefined, () => assert.fail('Verified files must be reused'), async () => f.archive)
    assert.equal(await fs.readFile(path.join(f.destination, 'options.txt'), 'utf8'), 'custom options')
    assert.equal(await fs.readFile(path.join(f.destination, 'saves/new/level.dat'), 'utf8'), 'new world')
})

test('installs and enables the donation resources once without resetting pack choices', async t => {
    const f = await fixture(t)
    await f.installPack(f.destination, undefined, f.download, async () => f.archive)
    const options = path.join(f.destination, 'options.txt')
    await fs.writeFile(options, 'resourcePacks:["vanilla","file/custom.zip"]\nlang:ko_kr')
    await f.prepareDonationResources(f.destination)
    assert.equal(await fs.readFile(options, 'utf8'), 'resourcePacks:["vanilla","file/custom.zip","file/SunlitDonationResources.zip"]\nlang:ko_kr')
    const installed = path.join(f.destination, 'resourcepacks', 'SunlitDonationResources.zip')
    assert(new AdmZip(installed).getEntry('assets/sunlitdonations/models/item/return_ticket.json'))
    await fs.writeFile(options, 'resourcePacks:["vanilla"]')
    await f.prepareDonationResources(f.destination)
    assert.equal(await fs.readFile(options, 'utf8'), 'resourcePacks:["vanilla"]')
})
