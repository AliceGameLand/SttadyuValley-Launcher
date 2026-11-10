const { execFile } = require('node:child_process')
const { createHash } = require('node:crypto')
const { createReadStream } = require('node:fs')
const fs = require('node:fs/promises')
const path = require('node:path')
const { promisify } = require('node:util')
const AdmZip = require('adm-zip')
const semver = require('semver')
const { getValidatableJavaPaths, javaExecFromRoot } = require('helios-core/java')
const { downloadFile } = require('./reliabledownload')

const execute = promisify(execFile)
const runtimeName = 'jdk-17.0.21+9-jre'
const archiveName = 'OpenJDK17U-jre_x64_windows_hotspot_17.0.21_9.zip'
const archiveUrl = 'https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.21%2B9/' + archiveName
const archiveSize = 43860024
const archiveHash = 'fe4656bd78fb09812dc38c49da777f79cc33e7ee435a254be82f9e7f40d9d117'
const preparations = new Map()

async function describe(executable, supported){
    if(typeof executable !== 'string' || !path.isAbsolute(executable)) return null
    try {
        await fs.access(executable)
        const command = executable.replace(/javaw\.exe$/i, 'java.exe')
        const { stderr } = await execute(command, ['-XshowSettings:properties', '-version'], { windowsHide: true, timeout: 10000 })
        const version = /^\s*java\.version\s*=\s*(\S+)/m.exec(stderr)?.[1]
        const vendor = /^\s*java\.vendor\s*=\s*(.+)/m.exec(stderr)?.[1]?.trim()
        const architecture = /^\s*os\.arch\s*=\s*(\S+)/m.exec(stderr)?.[1]
        const parsed = semver.coerce(version)
        if(!['amd64', 'x86_64'].includes(architecture) || parsed?.major !== 17 || !semver.satisfies(parsed, supported)) return null
        return { version, vendor }
    } catch {
        return null
    }
}

async function prepareRuntime({ dataDirectory, executable, supported }, progress){
    const directory = path.join(dataDirectory, 'runtime')
    const destination = path.join(directory, runtimeName)
    const managed = javaExecFromRoot(destination)
    if(await describe(executable, supported)) return executable
    if(await describe(managed, supported)) return managed
    const roots = await getValidatableJavaPaths(dataDirectory).catch(() => [])
    for(const root of roots){
        const candidate = javaExecFromRoot(root)
        if(await describe(candidate, supported)) return candidate
    }
    if(process.platform !== 'win32' || process.arch !== 'x64' || !semver.satisfies('17.0.21', supported)){
        throw new Error('No compatible Java 17 runtime is available for this platform.')
    }

    // Keep incomplete downloads out of the runtime cache and recover on the next attempt.
    const stage = path.join(directory, '.sttadyu-java17-staging')
    await fs.rm(stage, { recursive: true, force: true })
    try {
        const archive = path.join(stage, archiveName)
        await downloadFile(archiveUrl, archive, ({ transferred }) => {
            progress?.('download', Math.min(100, transferred / archiveSize * 100))
        })
        progress?.('verify')
        const hash = createHash('sha256')
        for await(const bytes of createReadStream(archive)) hash.update(bytes)
        if((await fs.stat(archive)).size !== archiveSize || hash.digest('hex') !== archiveHash){
            throw new Error('The Temurin Java archive failed size or SHA-256 verification.')
        }
        progress?.('extract')
        await new AdmZip(archive).extractAllToAsync(stage, false)
        const extracted = path.join(stage, runtimeName)
        if(!await describe(javaExecFromRoot(extracted), supported)){
            throw new Error('The downloaded Java runtime failed the compatibility check.')
        }
        await fs.rm(destination, { recursive: true, force: true })
        await fs.rename(extracted, destination)
        return managed
    } finally {
        await fs.rm(stage, { recursive: true, force: true }).catch(() => {})
    }
}

function prepare(options, progress){
    const key = path.resolve(options.dataDirectory).toLowerCase()
    if(!preparations.has(key)){
        const pending = prepareRuntime(options, progress).finally(() => preparations.delete(key))
        preparations.set(key, pending)
    }
    return preparations.get(key)
}

module.exports = { describe, prepare }
