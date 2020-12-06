/**
 * @ignore
 * BEGIN HEADER
 *
 * Contains:        TranslationProvider
 * CVM-Role:        Service Provider
 * Maintainer:      Hendrik Erz
 * License:         GNU GPL v3
 *
 * Description:     Takes care of translation updates and downloading new ones.
 *
 * END HEADER
 */

const path = require('path')
const fs = require('fs')
const { promisify } = require('util')
const { app, ipcMain } = require('electron')
const got = require('got')
const { getTranslationMetadata, trans } = require('../../common/i18n.js')
const moment = require('moment')

// We'll use the asynchronous version for convenience
const writeFileAsync = promisify(fs.writeFile)

module.exports = class TranslationProvider {
  constructor () {
    global.log.verbose('Translation provider booting up ...')
    this._languageDirectory = path.join(app.getPath('userData'), '/lang/')

    // NOTE: Possible race condition: If this provider is in the future being
    // loaded AFTER the translations are loaded, this will return undefined,
    // as both global.i18n and global.u18nFallback will not yet be set.
    // loadi18nMain therefore has to be called BEFORE any browser window may
    // request a translation.
    ipcMain.on('get-translation', (event) => {
      event.returnValue = {
        i18n: global.i18n,
        i18nFallback: global.i18nFallback
      }
    })
  }

  /**
   * Shuts down the provider
   * @return {Boolean} Whether or not the shutdown was successful
   */
  shutdown () {
    global.log.verbose('Translation provider shutting down ...')
    return true
  }
}
