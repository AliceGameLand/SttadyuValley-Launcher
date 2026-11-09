const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const source = fs.readFileSync(path.join(__dirname, '../app/assets/js/scripts/uibinder.js'), 'utf8')
for(const [name, accounts, firstLaunch, expected] of [
    ['First installation opens home and detects Prism', {}, true, 'home'],
    ['Returning users without accounts reach the import controls', {}, false, 'home'],
    ['Signed-in users continue to the home screen', { test: {} }, false, 'home']
]){
    test(name, async () => {
        let destination
        let detected = false
        const context = vm.createContext({
            isDev: true, process: { env: {} },
            ConfigManager: { getAuthAccounts: () => accounts, getSelectedServer: () => 'server', isFirstLaunch: () => firstLaunch },
            VIEWS: { landing: 'home', loginOptions: 'login' },
            prepareSettings: async () => {}, updateSelectedServer(){},
            detectPrismPack: () => { detected = true },
            setTimeout: callback => callback(), $: () => ({ show(){} }),
            switchView: (_current, next) => { destination = next }
        })
        vm.runInContext(source.slice(source.indexOf('async function showMainUI('), source.indexOf('function showFatalStartupError(')), context)
        await vm.runInContext('showMainUI({getServerById:()=>({})})', context)
        assert.equal(destination, expected)
        assert.equal(detected, true)
    })
}
