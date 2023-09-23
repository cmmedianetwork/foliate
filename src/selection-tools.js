import Gtk from 'gi://Gtk'
import Gio from 'gi://Gio'
import GObject from 'gi://GObject'
import WebKit from 'gi://WebKit'
import Gdk from 'gi://Gdk'
import { gettext as _ } from 'gettext'

import * as utils from './utils.js'
import { WebView } from './webview.js'

const getLanguage = lang => {
    try {
        return new Intl.Locale(lang).language
    } catch (e) {
        console.warn(e)
        return 'en'
    }
}

const commonStyle = `
html, body {
    color-scheme: light dark;
    font: menu;
}
h1 {
    font-size: larger;
}
h2 {
    font-size: smaller;
}
a:any-link {
    color: highlight;
}
ul, ol {
    padding-inline-start: 2em;
}
footer {
    font-size: smaller;
    opacity: .6;
    display: none;
}
[data-state="loaded"] footer {
    display: block;
}
[data-state="error"] main {
    display: flex;
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    text-align: center;
    justify-content: center;
    align-items: center;
}
`

const tools = {
    'dictionary': {
        label: _('Dictionary'),
        run: ({ text, lang }) => {
            const language = getLanguage(lang)
            return `
<base href="https://en.wiktionary.org/wiki/Wiktionary:Main_Page">
<style>
${commonStyle}
ul {
    margin: .5em 0;
    font-style: italic;
    opacity: .75;
    font-size: smaller;
    list-style: none;
}
h1 {
    padding-inline-end: 1em;
    display: inline;
}
hgroup p {
    font-size: smaller;
    display: inline;
}
</style>
<main></main>
<footer><p>${_('From <a id="link">Wiktionary</a>, released under the <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA License</a>.')}</footer>
<script>
const main = document.querySelector('main')
const footer = document.querySelector('footer')
const wiktionary = (word, language, languageName) => {
    document.body.dataset.state = 'loading'
    return fetch('https://en.wiktionary.org/api/rest_v1/page/definition/' + encodeURI(word))
        .then(res => res.ok ? res.json() : Promise.reject(new Error()))
        .then(json => {
            const results = language ? json[language]
                : languageName ? Object.values(json)
                    .find(x => x.some(x => x.language === languageName))
                : json['en']
            const hgroup = document.createElement('hgroup')
            const h1 = document.createElement('h1')
            h1.innerText = word
            const p = document.createElement('p')
            p.innerText = results[0].language
            hgroup.append(h1, p)
            main.append(hgroup)
            for (const { partOfSpeech, definitions } of results) {
                const h2 = document.createElement('h2')
                h2.innerText = partOfSpeech
                const ol = document.createElement('ol')
                main.append(h2, ol)
                for (const { definition, examples } of definitions) {
                    const li = document.createElement('li')
                    li.innerHTML = definition
                    ol.append(li)
                    const ul = document.createElement('ul')
                    li.append(ul)
                    if (examples) for (const example of examples) {
                        const li = document.createElement('li')
                        li.innerHTML = example
                        ul.append(li)
                    }
                }
            }
            document.querySelector('#link').href = '/wiki/' + word
            document.body.dataset.state = 'loaded'
        })
        .catch(e => {
            console.error(e)
            const lower = word.toLocaleLowerCase(language)
            if (lower !== word) return wiktionary(lower, language)
            else {
                const div = document.createElement('div')
                const h1 = document.createElement('h1')
                h1.innerText = decodeURIComponent("${encodeURIComponent(_('No Definitions Found'))}")
                const p = document.createElement('p')
                p.innerHTML = \`<a href="https://en.wiktionary.org/w/index.php?search=${encodeURIComponent(text)}">${_('Search on Wiktionary')}</a>\`
                div.append(h1, p)
                main.append(div)
                document.body.dataset.state = 'error'
            }
        })
}

// see https://en.wiktionary.org/wiki/Wiktionary:Namespace
const wikiNamespaces = [
    'Media', 'Special', 'Talk', 'User', 'Wiktionary', 'File', 'MediaWiki',
    'Template', 'Help', 'Category',
    'Summary', 'Appendix', 'Concordance', 'Index', 'Rhymes', 'Transwiki',
    'Thesaurus', 'Citations', 'Sign',
]

main.addEventListener('click', e => {
    const { target } = e
    if (target.tagName === 'A') {
        const href = target.getAttribute('href')
        if (href.startsWith('/wiki/')) {
            const [word, languageName] = href.replace('/wiki/', '').split('#')
            if (wikiNamespaces.every(namespace => !word.startsWith(namespace + ':')
            && !word.startsWith(namespace + '_talk:'))) {
                e.preventDefault()
                main.replaceChildren()
                wiktionary(word.replaceAll('_', ' '), null, languageName)
            }
        }
    }
})

wiktionary(decodeURIComponent("${encodeURIComponent(text)}"), "${language}")
</script>`
        },
    },
    'wikipedia': {
        label: _('Wikipedia'),
        run: ({ text, lang }) => {
            const language = getLanguage(lang)
            return `<style>
${commonStyle}
hgroup {
    color: #fff;
    background-position: center center;
    background-size: cover;
    background-color: rgba(0, 0, 0, .4);
    background-blend-mode: darken;
    border-radius: 6px;
    padding: 12px;
    margin: -8px;
    margin-bottom: 0;
    min-height: 100px;
}
</style>
<main></main>
<footer><p>${_('From <a id="link">Wikipedia</a>, released under the <a href="https://en.wikipedia.org/wiki/Wikipedia:Text_of_the_Creative_Commons_Attribution-ShareAlike_4.0_International_License">CC BY-SA License</a>.')}</footer>
<script>
const main = document.querySelector('main')
document.body.dataset.state = 'loading'
const word = decodeURIComponent("${encodeURIComponent(text)}")
fetch('https://${language}.wikipedia.org/api/rest_v1/page/summary/' + word)
    .then(res => res.ok ? res.json() : Promise.reject(new Error()))
    .then(json => {
        const hgroup = document.createElement('hgroup')
        const h1 = document.createElement('h1')
        h1.innerHTML = json.titles.display
        hgroup.append(h1)
        if (json.description) {
            const p = document.createElement('p')
            p.innerText = json.description
            hgroup.append(p)
        }
        if (json.thumbnail)
            hgroup.style.backgroundImage = 'url("' + json.thumbnail.source + '")'
        const div = document.createElement('div')
        div.innerHTML = json.extract_html
        main.append(hgroup, div)
        main.dir = json.dir
        document.querySelector('#link').href = json.content_urls.desktop.page
        document.body.dataset.state = 'loaded'
    })
    .catch(e => {
        console.error(e)
        const div = document.createElement('div')
        const h1 = document.createElement('h1')
        h1.innerText = decodeURIComponent("${encodeURIComponent(_('No Definitions Found'))}")
        const p = document.createElement('p')
        p.innerHTML = \`<a href="https://${language}.wikipedia.org/w/index.php?search=${encodeURIComponent(text)}">${_('Search on Wikipedia')}</a>\`
        div.append(h1, p)
        main.append(div)
        document.body.dataset.state = 'error'
    })
</script>`
        },
    },
}

const SelectionToolPopover = GObject.registerClass({
    GTypeName: 'FoliateSelectionToolPopover',
}, class extends Gtk.Popover {
    #webView = utils.connect(new WebView({
        settings: new WebKit.Settings({
            enable_write_console_messages_to_stdout: true,
            enable_back_forward_navigation_gestures: false,
            enable_hyperlink_auditing: false,
            enable_html5_database: false,
            enable_html5_local_storage: false,
        }),
    }), {
        'decide-policy': (_, decision, type) => {
            switch (type) {
                case WebKit.PolicyDecisionType.NAVIGATION_ACTION:
                case WebKit.PolicyDecisionType.NEW_WINDOW_ACTION: {
                    const { uri } = decision.navigation_action.get_request()
                    if (!uri.startsWith('foliate:')) {
                        decision.ignore()
                        Gtk.show_uri(null, uri, Gdk.CURRENT_TIME)
                        return true
                    }
                }
            }
        },
    })
    constructor(params) {
        super(params)
        Object.assign(this, {
            width_request: 300,
            height_request: 300,
        })
        this.child = this.#webView
        this.#webView.set_background_color(new Gdk.RGBA())
    }
    load(html) {
        this.#webView.loadHTML(html, 'foliate:selection-tool')
            .then(() => this.#webView.opacity = 1)
            .catch(e => console.error(e))
    }
})

const getSelectionToolPopover = utils.memoize(() => new SelectionToolPopover())

export const SelectionPopover = GObject.registerClass({
    GTypeName: 'FoliateSelectionPopover',
    Template: pkg.moduleuri('ui/selection-popover.ui'),
    Signals: {
        'show-popover': { param_types: [Gtk.Popover.$gtype] },
        'run-tool': { return_type: GObject.TYPE_JSOBJECT },
    },
}, class extends Gtk.PopoverMenu {
    constructor(params) {
        super(params)
        const model = this.menu_model
        const section = new Gio.Menu()
        model.insert_section(1, null, section)

        const group = new Gio.SimpleActionGroup()
        this.insert_action_group('selection-tools', group)

        for (const [name, tool] of Object.entries(tools)) {
            const action = new Gio.SimpleAction({ name })
            action.connect('activate', () => {
                const popover = getSelectionToolPopover()
                Promise.resolve(tool.run(this.emit('run-tool')))
                    .then(x => popover.load(x))
                    .catch(e => console.error(e))
                this.emit('show-popover', popover)
            })
            group.add_action(action)
            section.append(tool.label, `selection-tools.${name}`)
        }
    }
})