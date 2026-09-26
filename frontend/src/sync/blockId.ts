import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

function generateBlockId(): string {
    return 'blk-' + Math.random().toString(36).slice(2, 10) + '-' + Date.now().toString(36)
}

/**
 * Assigns a stable, unique blockId to every top-level block node
 * (paragraph, heading, list item, etc.) so the sync engine can
 * target ops at specific blocks instead of the whole document.
 */
export const BlockId = Extension.create({
    name: 'blockId',

    addGlobalAttributes() {
        return [
            {
                types: ['paragraph', 'heading', 'listItem', 'blockquote', 'codeBlock'],
                attributes: {
                    blockId: {
                        default: null,
                        parseHTML: (element) => element.getAttribute('data-block-id'),
                        renderHTML: (attributes) => {
                            if (!attributes.blockId) return {}
                            return { 'data-block-id': attributes.blockId }
                        },
                    },
                },
            },
        ]
    },

    addProseMirrorPlugins() {
        return [
            new Plugin({
                key: new PluginKey('blockIdAssigner'),
                appendTransaction: (transactions, oldState, newState) => {
                    const docChanged = transactions.some((tr) => tr.docChanged)
                    if (!docChanged) return null

                    let tr = newState.tr
                    let modified = false

                    newState.doc.descendants((node, pos) => {
                        const isBlockType = ['paragraph', 'heading', 'listItem', 'blockquote', 'codeBlock'].includes(node.type.name)
                        if (isBlockType && !node.attrs.blockId) {
                            tr = tr.setNodeAttribute(pos, 'blockId', generateBlockId())
                            modified = true
                        }
                    })

                    return modified ? tr : null
                },
            }),
        ]
    },
})