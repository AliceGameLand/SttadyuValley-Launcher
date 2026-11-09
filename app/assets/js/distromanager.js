const { DistributionAPI } = require('helios-core/common')
const { ensureDir, writeJson } = require('fs-extra')
const path = require('node:path')

const ConfigManager = require('./configmanager')
const distribution = require('../distribution.json')

const launcherDirectory = ConfigManager.getLauncherDirectory()
const api = new DistributionAPI(launcherDirectory, null, null, null, true)

// The same bundled profile is read by the renderer and the file repair worker.
let prepared
function loadBundledDistribution() {
    prepared ??= ensureDir(launcherDirectory)
        .then(() => writeJson(path.join(launcherDirectory, 'distribution_dev.json'), distribution))
        .then(() => api.getDistributionLocalLoadOnly())
        .catch(error => {
            prepared = null
            throw error
        })
    return prepared
}

api.getDistribution = loadBundledDistribution
api.refreshDistributionOrFallback = loadBundledDistribution
exports.DistroAPI = api
