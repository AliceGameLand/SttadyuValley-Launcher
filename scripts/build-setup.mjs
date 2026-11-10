import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { build, Platform } from 'electron-builder'
import { Arch } from 'builder-util'

const require = createRequire(import.meta.url)
const root = path.resolve(import.meta.dirname, '..')
const metadata = require('../package.json')
const stage = path.join(root, 'dist/setup-ui-app')
const installerFiles = ['index.html', 'main.cjs', 'paths.cjs', 'preload.cjs', 'renderer.js', 'style.css', 'update-target.cjs']
const assets = {
    'SealCircle.png': 'app/assets/images/SealCircle.png',
    'PretendardVariable.woff2': 'app/assets/fonts/PretendardVariable.woff2',
    'Pretendard-LICENSE.txt': 'app/assets/fonts/Pretendard-LICENSE.txt',
    'icon.png': 'build/icon.png',
    'theme.css': 'app/assets/css/theme.css'
}

fs.mkdirSync(path.join(stage, 'assets'), { recursive: true })
for(const name of installerFiles) fs.copyFileSync(path.join(root, 'installer', name), path.join(stage, name))
for(const [name, source] of Object.entries(assets)) fs.copyFileSync(path.join(root, source), path.join(stage, 'assets', name))
fs.writeFileSync(path.join(stage, 'package.json'), JSON.stringify({
    name: 'sttadyu-valley-setup',
    version: metadata.version,
    productName: "s'따듀밸리 설치",
    main: 'main.cjs',
    launcherExecutable: 'SttadyuValley.exe',
    private: true
}))

// NSIS uses the same Electron archive for the installer window and the launcher.
await build({
    projectDir: root,
    targets: Platform.WINDOWS.createTarget(['nsis'], Arch.x64),
    publish: 'never',
    config: {
        extends: path.join(root, 'electron-builder.yml'),
        directories: { output: 'dist/custom-setup' },
        artifactName: 'sttadyu-valley-setup-${version}.${ext}',
        extraResources: [{
            from: stage,
            to: 'setup-wizard',
            filter: ['package.json', ...installerFiles, ...Object.keys(assets).map(name => 'assets/' + name)]
        }],
        nsis: { include: 'build/setup-wizard.nsh', runAfterFinish: false }
    }
})
