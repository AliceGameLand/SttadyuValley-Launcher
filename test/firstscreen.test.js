const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const source = fs.readFileSync(path.join(__dirname, '../app/assets/js/scripts/uibinder.js'), 'utf8')
for(const [name, account, expected] of [
    ['First installation opens Microsoft sign-in', null, 'login'],
    ['Returning users without a selected account open Microsoft sign-in', null, 'login'],
    ['Signed-in users continue to the home screen', { type: 'microsoft' }, 'home']
]){
    test(name, async () => {
        let destination
        let cancelEnabled
        const context = vm.createContext({
            isDev: true, process: { env: {} },
            ConfigManager: { getSelectedAccount: () => account, getSelectedServer: () => 'server' },
            VIEWS: { landing: 'home', loginOptions: 'login' },
            prepareSettings: async () => {}, updateSelectedServer(){},
            loginOptionsCancelEnabled: enabled => { cancelEnabled = enabled },
            setTimeout: callback => callback(), $: () => ({ show(){} }),
            switchView: (_current, next) => { destination = next }
        })
        vm.runInContext(source.slice(source.indexOf('async function showMainUI('), source.indexOf('function showFatalStartupError(')), context)
        await vm.runInContext('showMainUI({getServerById:()=>({})})', context)
        assert.equal(destination, expected)
        if(!account){
            assert.equal(cancelEnabled, false)
            assert.equal(context.loginOptionsViewOnLoginSuccess, 'home')
            assert.equal(context.loginOptionsViewOnLoginCancel, 'login')
        }
    })
}
