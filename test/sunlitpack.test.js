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
    const prism = path.join(base, 'prism')
    const destination = path.join(base, 'game')
    const zip = new AdmZip()
    zip.addFile('overrides/configureddefaults/options.txt', Buffer.from('resourcePacks:[]'))
    zip.addFile('overrides/configureddefaults/servers.dat', Buffer.from('ignore'))
    zip.addFile('overrides/kubejs/server_scripts/example.js', Buffer.from('pack default'))
    const archive = zip.toBuffer()
    const contents = Buffer.from('test mod')
    const pack = {
        version: '4.1.5A', minecraft: '1.20.1', forge: 'forge-47.4.0',
        archiveSha256: createHash('sha256').update(archive).digest('hex'),
        files: [{ path: 'mods/farm.jar', sha1: createHash('sha1').update(contents).digest('hex') }]
    }
    await fs.outputJson(path.join(prism, 'mmc-pack.json'), {
        components: [{ uid: 'net.minecraft', version: '1.20.1' }, { uid: 'net.minecraftforge', version: '47.4.0' }]
    })
    await fs.outputFile(path.join(prism, 'instance.cfg'), 'ManagedPackVersionID=8980840\n')
    await fs.outputFile(path.join(prism, 'minecraft/options.txt'), 'personal')
    await fs.outputFile(path.join(prism, 'minecraft/saves/private/level.dat'), 'private')
    const source = await fs.readFile(path.join(__dirname, '../app/assets/js/sunlitpack.js'), 'utf8')
    const module = { exports: {} }
    vm.runInNewContext(source, {
        module, process, require: name => name === '../config/sunlit-lock.json' ? pack : require(name)
    })
    return {
        prism, destination, archive, ...module.exports,
        addMod: () => fs.outputFile(path.join(prism, 'minecraft/mods/farm(1).jar'), contents)
    }
}

test('validates exact pack content before marking ready and safely retries an interrupted import', async t => {
    const f = await fixture(t)
    await assert.rejects(f.importPack(f.prism, f.destination, undefined, async () => f.archive),
        error => error.missing[0].path === 'mods/farm.jar')
    assert.equal(f.isReady(f.destination), false)
    await f.addMod()
    await assert.rejects(f.importPack(f.prism, f.destination, undefined, async () => Buffer.alloc(0)), /검증/)
    assert.equal(f.isReady(f.destination), false)
    await f.importPack(f.prism, f.destination, undefined, async () => f.archive)
    assert.equal(f.isReady(f.destination), true)
    assert.equal(await fs.readFile(path.join(f.destination, 'mods/farm.jar'), 'utf8'), 'test mod')
    assert.equal(await fs.readFile(path.join(f.destination, 'options.txt'), 'utf8'), 'resourcePacks:[]')
    for(const file of ['saves/private/level.dat', 'configureddefaults/servers.dat']){
        assert.equal(await fs.pathExists(path.join(f.destination, file)), false)
    }
    await fs.outputFile(path.join(f.destination, 'options.txt'), 'custom options')
    await fs.outputFile(path.join(f.destination, 'saves/new/level.dat'), 'new world')
    await f.importPack(f.prism, f.destination, undefined, async () => f.archive)
    assert.equal(await fs.readFile(path.join(f.destination, 'options.txt'), 'utf8'), 'custom options')
    assert.equal(await fs.readFile(path.join(f.destination, 'saves/new/level.dat'), 'utf8'), 'new world')
})
