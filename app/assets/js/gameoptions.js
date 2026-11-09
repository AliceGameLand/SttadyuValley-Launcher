const fs = require('fs')
const path = require('path')

// Disable vanilla onboarding without resetting existing player preferences.
exports.disableTutorial = function(gameDirectory, fullscreen){
    const optionsPath = path.join(gameDirectory, 'options.txt')
    const original = fs.existsSync(optionsPath) ? fs.readFileSync(optionsPath, 'utf8') : ''
    const newline = original.includes('\r\n') ? '\r\n' : '\n'
    let updated = /^tutorialStep:[^\r\n]*/m.test(original)
        ? original.replace(/^tutorialStep:[^\r\n]*/gm, 'tutorialStep:none')
        : original + (original.length && !original.endsWith('\n') ? newline : '') + 'tutorialStep:none' + newline
    if(typeof fullscreen === 'boolean'){
        updated = /^fullscreen:[^\r\n]*/m.test(updated)
            ? updated.replace(/^fullscreen:[^\r\n]*/gm, 'fullscreen:' + fullscreen)
            : updated + (updated.length && !updated.endsWith('\n') ? newline : '') + 'fullscreen:' + fullscreen + newline
    }
    if(updated !== original){
        fs.writeFileSync(optionsPath, updated, 'utf8')
    }
}


// Replace the pack defaults once. Later shader choices belong to the player.
exports.applyShaderDefaults = function(gameDirectory){
    const marker = path.join(gameDirectory, '.sttadyu-shader-defaults')
    if(fs.existsSync(marker)) return
    const file = path.join(gameDirectory, 'config', 'oculus.properties')
    const source = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
    const enabled = /^enableShaders\s*=\s*([^\r\n]*)/m.exec(source)?.[1].trim()
    const selected = /^shaderPack\s*=\s*([^\r\n]*)/m.exec(source)?.[1].trim()
    const stock = enabled === 'false' && selected === 'ComplementaryReimagined_r5.6.1 + Clrwl_1.0.4.zip'
    if(stock || (enabled == null && selected == null)){
        const newline = source.includes('\r\n') ? '\r\n' : '\n'
        const updated = stock
            ? source.replace(/^enableShaders[ \t]*=[^\r\n]*/m, 'enableShaders=true')
                .replace(/^shaderPack[ \t]*=[^\r\n]*/m, 'shaderPack=ComplementaryReimagined_r5.9.1.zip')
            : source + (source && !source.endsWith('\n') ? newline : '')
                + ['enableShaders=true', 'shaderPack=ComplementaryReimagined_r5.9.1.zip', ''].join(newline)
        fs.mkdirSync(path.dirname(file), { recursive: true })
        fs.writeFileSync(file, updated, 'utf8')
    }
    fs.writeFileSync(marker, '')
}

// Migrate stock values once so subsequent player changes remain intact.
exports.applyDisplayDefaults = function(gameDirectory){
    const marker = path.join(gameDirectory, '.sttadyu-display-defaults')
    if(fs.existsSync(marker)) return
    const file = path.join(gameDirectory, 'options.txt')
    const original = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
    const newline = original.includes('\r\n') ? '\r\n' : '\n'
    let updated = original
    for(const [key, stock, target] of [['lang', 'en_us', 'ko_kr'], ['guiScale', '3', '4']]){
        const pattern = new RegExp('^' + key + ':([^\\r\\n]*)', 'm')
        const match = pattern.exec(updated)
        const line = key + ':' + target
        if(!match){
            updated += (updated && !updated.endsWith('\n') ? newline : '') + line + newline
        } else if(match[1] === stock){
            updated = updated.replace(pattern, line)
        }
    }
    if(updated !== original) fs.writeFileSync(file, updated, 'utf8')
    fs.writeFileSync(marker, '')
}
