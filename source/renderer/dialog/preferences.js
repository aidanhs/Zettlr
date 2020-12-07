/* global $ */
/**
 * @ignore
 * BEGIN HEADER
 *
 * Contains:        PreferencesDialog class
 * CVM-Role:        View
 * Maintainer:      Hendrik Erz
 * License:         GNU GPL v3
 *
 * Description:     This class ensures all the preferences of Zettlr can be
 *                  customised to your likings.
 *
 * END HEADER
 */

const ZettlrDialog = require('./zettlr-dialog.js')
const validate = require('../../common/validate.js')
const { ipcRenderer } = require('electron')
const { trans } = require('../../common/i18n')
const generateId = require('../../common/util/generate-id')
const renderTemplate = require('../util/render-template')
const serializeFormData = require('../../common/util/serialize-form-data')

class PreferencesDialog extends ZettlrDialog {
  constructor () {
    super()
    this._dialog = 'preferences'
    this._textTimeout = null
  }

  get spinner () {
    return renderTemplate(
      `<div class="sk-three-bounce">
        <div class="sk-child sk-bounce1"></div>
        <div class="sk-child sk-bounce2"></div>
        <div class="sk-child sk-bounce3"></div>
      </div>`
    )
  }

  preInit (data) {
    // The template expects a simple string
    data.attachmentExtensions = data.attachmentExtensions.join(', ')

    // Determine the ability of the OS to switch to dark mode
    data.hasOSDarkMode = [ 'darwin', 'win32' ].includes(process.platform)

    data.languages = [] // Initialise
    // Make sure the languages are unique and
    // the duplicates (internal + external files)
    // are removed from the array.
    for (let l of data.supportedLangs) {
      if (!data.languages.find(e => e.bcp47 === l)) {
        data.languages.push({
          'bcp47': l,
          'completion': 100,
        })
      }
    }

    // Now prepopulate some stuff for autoCorrect
    data.autoCorrectReplacements = []
    for (let replacement of data.editor.autoCorrect.replacements) {
      data.autoCorrectReplacements.push({ 'key': replacement.key, 'value': replacement.val })
    }

    // For ease of access in Handlebars, we also need to provide it with the current
    // quotes
    let q = data.editor.autoCorrect.quotes
    if (!q) {
      data.primaryQuotes = '"…"'
      data.secondaryQuotes = "'…'"
    } else {
      data.primaryQuotes = q.double.start + '…' + q.double.end
      data.secondaryQuotes = q.single.start + '…' + q.single.end
    }

    return data
  }

  get appLangElement () {
    return document.getElementById('app-lang')
  }

  get appLang () {
    return this.appLangElement.value
  }

  getLanguageOptionElement (language) {
    return this.appLangElement.querySelector(`option[value="${language}"]`)
  }

  postAct () {
    // Activate the form to be submitted
    let form = this._modal.querySelector('form#dialog')
    form.addEventListener('submit', (e) => {
      e.preventDefault()
      // Give the ZettlrBody object the results
      this.proceed(serializeFormData(form))
    })

    // Begin: functions for the zkn regular expression fields
    const zknFreeIdElement = document.getElementById('pref-zkn-free-id')
    $('#reset-id-regex').on('click', (e) => {
      zknFreeIdElement.value = '(\\d{14})'
    })
    $('#reset-linkstart-regex').on('click', (e) => {
      document.getElementById('pref-zkn-free-linkstart').value = '[['
    })
    $('#reset-linkend-regex').on('click', (e) => {
      document.getElementById('pref-zkn-free-linkend').value = ']]'
    })
    const zknIdGenElement = document.getElementById('pref-zkn-id-gen')
    $('#reset-id-generator').on('click', (e) => {
      zknIdGenElement.value = '%Y%M%D%h%m%s'
    })

    // Reset the pandoc command
    $('#reset-pandoc-command').on('click', (e) => {
      document.getElementById('pandocCommand').value = 'pandoc "$infile$" -f markdown $outflag$ $tpl$ $toc$ $tocdepth$ --citeproc --bibliography $bibliography$ $cslstyle$ $standalone$ --pdf-engine=xelatex --mathjax -o "$outfile$"'
    })

    const reportTestResult = (resultTranslationKey) => {
      document.getElementById('pass-check').textContent = trans(resultTranslationKey)
    }
    $('#generate-id').on('click', (e) => {
      const idPattern = zknIdGenElement.value
      const idMatcher = zknFreeIdElement.value
      const id = generateId(idPattern)
      const re = new RegExp(`^${idMatcher}$`)
      document.getElementById('generator-tester').textContent = id

      if (re.test(id)) {
        reportTestResult('dialog.preferences.zkn.pass_check_yes')
      } else {
        reportTestResult('dialog.preferences.zkn.pass_check_no')
      }
    })

    // BEGIN functionality for the image constraining options
    $('#imageWidth, #imageHeight').on('input', (e) => {
      const width = document.getElementById('imageWidth').value
      const height = document.getElementById('imageHeight').value
      $('#preview-image-sizes').html(`${width}% &times; ${height}%`)
    })

    // BEGIN functionality for theme switching
    $('.theme-mockup').on('click', function (e) {
      let elem = $(this).attr('data-theme')
      // Simply send the respective command to main and let the magic happen!
      global.ipc.send(`switch-theme-${elem}`)
    })

    // BEGIN functionality for the AutoCorrect options
    $('#add-autocorrect-key').click(function (e) {
      e.stopPropagation()
      e.preventDefault()
      let keyCol = $('<td>').html('<div class="input-button-group"><input type="text" name="autoCorrectKeys[]"></div>')
      let valCol = $('<td>').html('<div class="input-button-group"><input type="text" name="autoCorrectValues[]"> <button class="autocorrect-remove-row"><clr-icon shape="times"></clr-icon></button></div>')
      let row = $('<tr>').append(keyCol, valCol)
      $('#autocorrect-key-container').append(row)
    })

    $('#autocorrect-key-container').on('click', '.autocorrect-remove-row', function (e) {
      e.preventDefault()
      $(e.target).parent().parent().parent().detach() // Button -> div -> td -> tr
    })

    $('.mq-select').click(function (e) {
      e.preventDefault()
      let primary = e.target.dataset.primary
      let secondary = e.target.dataset.secondary

      $('#autoCorrectQuotesDouble')[0].options.selectedIndex = primary
      $('#autoCorrectQuotesSingle')[0].options.selectedIndex = secondary
    })
  }

  proceed (data) {
    // First remove potential error-classes
    for (const element of this.getModal().querySelectorAll('input')) {
      element.classList.remove('has-error')
    }

    let cfg = {}

    // Standard preferences
    cfg['darkTheme'] = (data.find(elem => elem.name === 'darkTheme') !== undefined)
    cfg['fileMeta'] = (data.find(elem => elem.name === 'fileMeta') !== undefined)
    cfg['hideDirs'] = (data.find(elem => elem.name === 'hideDirs') !== undefined)
    cfg['alwaysReloadFiles'] = (data.find(elem => elem.name === 'alwaysReloadFiles') !== undefined)
    cfg['muteLines'] = (data.find(elem => elem.name === 'muteLines') !== undefined)
    cfg['export.stripIDs'] = (data.find(elem => elem.name === 'export.stripIDs') !== undefined)
    cfg['export.stripTags'] = (data.find(elem => elem.name === 'export.stripTags') !== undefined)
    cfg['debug'] = (data.find(elem => elem.name === 'debug') !== undefined)
    cfg['checkForBeta'] = (data.find(elem => elem.name === 'checkForBeta') !== undefined)
    cfg['enableRMarkdown'] = (data.find(elem => elem.name === 'enableRMarkdown') !== undefined)
    cfg['window.nativeAppearance'] = (data.find(elem => elem.name === 'window.nativeAppearance') !== undefined)
    cfg['newFileDontPrompt'] = (data.find(elem => elem.name === 'newFileDontPrompt') !== undefined)

    // Display checkboxes
    cfg['display.renderCitations'] = (data.find(elem => elem.name === 'display.renderCitations') !== undefined)
    cfg['display.renderIframes'] = (data.find(elem => elem.name === 'display.renderIframes') !== undefined)
    cfg['display.renderImages'] = (data.find(elem => elem.name === 'display.renderImages') !== undefined)
    cfg['display.renderLinks'] = (data.find(elem => elem.name === 'display.renderLinks') !== undefined)
    cfg['display.renderMath'] = (data.find(elem => elem.name === 'display.renderMath') !== undefined)
    cfg['display.renderTasks'] = (data.find(elem => elem.name === 'display.renderTasks') !== undefined)
    cfg['display.renderHTags'] = (data.find(elem => elem.name === 'display.renderHTags') !== undefined)
    cfg['display.useFirstHeadings'] = (data.find(elem => elem.name === 'display.useFirstHeadings') !== undefined)

    cfg['editor.autoCloseBrackets'] = (data.find(elem => elem.name === 'editor.autoCloseBrackets') !== undefined)
    cfg['editor.homeEndBehaviour'] = (data.find(elem => elem.name === 'editor.homeEndBehaviour') !== undefined)
    cfg['editor.enableTableHelper'] = (data.find(elem => elem.name === 'editor.enableTableHelper') !== undefined)
    cfg['editor.countChars'] = (data.find(elem => elem.name === 'editor.countChars') !== undefined)
    cfg['editor.autoCorrect.active'] = (data.find(elem => elem.name === 'editor.autoCorrect.active') !== undefined)
    cfg['editor.rtlMoveVisually'] = (data.find(elem => elem.name === 'editor.rtlMoveVisually') !== undefined)
    cfg['zkn.autoCreateLinkedFiles'] = (data.find(elem => elem.name === 'zkn.autoCreateLinkedFiles') !== undefined)

    cfg['watchdog.activatePolling'] = (data.find(elem => elem.name === 'watchdog.activatePolling') !== undefined)

    // Now for the AutoCorrect preferences - first the replacement table
    let keys = data.filter((e) => e.name === 'autoCorrectKeys[]')
    let vals = data.filter((e) => e.name === 'autoCorrectValues[]')
    cfg['editor.autoCorrect.replacements'] = []
    for (let i = 0; i < keys.length; i++) {
      cfg['editor.autoCorrect.replacements'].push({ key: keys[i].value, val: vals[i].value })
    }

    // And then second the quotes. We split them at the hyphen character
    // (so we only) need to maintain one instance of these things.
    let prim = data.find(elem => elem.name === 'autoCorrectQuotesDouble').value.split('…')
    let sec = data.find(elem => elem.name === 'autoCorrectQuotesSingle').value.split('…')
    if (prim[0] === '"' && prim[1] === '"' && sec[0] === "'" && sec[1] === "'") {
      // If defaults are selected, disable Magic Quotes
      cfg['editor.autoCorrect.quotes'] = false
    } else {
      cfg['editor.autoCorrect.quotes'] = {
        'double': { 'start': prim[0], 'end': prim[1] },
        'single': { 'start': sec[0], 'end': sec[1] }
      }
    }

    // Copy over all other field values from the result set.
    for (let r of data) {
      // Only non-missing to not overwrite the checkboxes that ARE checked with a "yes"
      if (!cfg.hasOwnProperty(r.name)) {
        // Convert numbers to prevent validation errors.
        if (!isNaN(r.value) && r.value.trim() !== '') r.value = Number(r.value)
        cfg[r.name] = r.value
      }
    }

    // Now finally the attachment extensions.
    if (cfg.hasOwnProperty('attachmentExtensions')) {
      let attachments = cfg['attachmentExtensions'].split(',')
      for (let i = 0; i < attachments.length; i++) {
        attachments[i] = attachments[i].trim().replace(/\s/g, '')
        if (attachments[i].length < 2) {
          attachments.splice(i, 1)
          i--
          continue
        }
        if (attachments[i].charAt(0) !== '.') {
          attachments[i] = '.' + attachments[i]
        }

        // Convert to lower case
        attachments[i] = attachments[i].toLowerCase()
      }
      cfg['attachmentExtensions'] = attachments
    }

    // Validate dat shit.
    let unvalidated = validate(cfg)

    if (unvalidated.length > 0) {
      // For brevity reasons only show one at a time (they have to be resolved either way)
      this.getModal().find('.error-info').text(unvalidated[0].reason)
      for (let prop of unvalidated) {
        // Indicate which ones were wrong.
        this.getModal().find(`input[name="${prop.key}"]`).first().addClass('has-error')
      }
      return // Don't try to update falsy settings.
    }

    // Finally send and close this dialog.
    global.ipc.send('update-config', cfg)
    this.close()
  }
}

module.exports = PreferencesDialog
