const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { getServerIcon } = require('../app/assets/js/servericon')
const distribution = require('../app/assets/distribution.json')

test('the bundled profile has one Sunlit Valley pack and its local icon', () => {
    assert.equal(distribution.servers.length, 1)
    const [profile] = distribution.servers
    assert.equal(profile.id, 'sunlit-valley-4.1.5a')
    assert.equal(profile.name, 's\'따듀밸리')
    assert.equal(profile.autoconnect, true)
    assert.equal(profile.address, 'localhost:25569')
    assert.equal(getServerIcon(profile), profile.icon)
    const bytes = fs.readFileSync(path.join(__dirname, '../app', profile.icon))
    assert.equal(bytes.subarray(1, 4).toString(), 'PNG')
})
