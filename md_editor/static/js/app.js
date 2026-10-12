// Global State & Document Management (Up to 3 Panes)
const documents = new Map(); // docId -> DocumentModel
const MAX_PANES = 3;

const panes = [
    { id: 0, tabs: [], activeTabId: null, containerEl: null, tabsListEl: null, nameInputEl: null, extLabelEl: null, saveBtnEl: null, promptBarEl: null, cellsListEl: null, cellsScrollEl: null, dropOverlayEl: null, closeBtnEl: null, splitBtnEl: null },
    { id: 1, tabs: [], activeTabId: null, containerEl: null, tabsListEl: null, nameInputEl: null, extLabelEl: null, saveBtnEl: null, promptBarEl: null, cellsListEl: null, cellsScrollEl: null, dropOverlayEl: null, closeBtnEl: null, splitBtnEl: null },
    { id: 2, tabs: [], activeTabId: null, containerEl: null, tabsListEl: null, nameInputEl: null, extLabelEl: null, saveBtnEl: null, promptBarEl: null, cellsListEl: null, cellsScrollEl: null, dropOverlayEl: null, closeBtnEl: null, splitBtnEl: null }
];

let openPaneCount = 1; // 1, 2, or 3
let activePaneIndex = 0; // 0, 1, or 2
let existingFiles = []; // Track existing .md files in workspace
let clipboardCell = null; // Store copied/cut cell content and metadata
const MAX_STACK_SIZE = 50;

// Shortcut sequence tracking

let isCtrlPressed = false;
let dKeyTimeout = null;
let gKeyTimeout = null;
let numberBufferTimeout = null;
let pendingAction = null; // For unsaved changes modal confirmation
let isSwitchingTabOrPane = false; // Guard to preserve edit mode across tab/pane switches

// DOM Elements
const emptyState = document.getElementById('empty-state');
const notebookContainer = document.getElementById('notebook-container');
const fileListContainer = document.getElementById('file-list');
const modeBadge = document.getElementById('mode-badge');
const notebookStatus = document.getElementById('notebook-status');
const emptyNewBtn = document.getElementById('empty-new-btn');
const refreshFilesBtn = document.getElementById('refresh-files-btn');
const btnNewFile = document.getElementById('btn-new-file');
const btnNewFolder = document.getElementById('btn-new-folder');
const breadcrumbBar = document.getElementById('breadcrumb-bar');
const sidebarContainer = document.getElementById('sidebar-container');
const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
const fileBrowser = document.getElementById('file-browser');
const btnToggleToc = document.getElementById('btn-toggle-toc');
const tocPanel = document.getElementById('toc-panel');
const tocList = document.getElementById('toc-list');
const refreshTocBtn = document.getElementById('refresh-toc-btn');
const closeTocBtn = document.getElementById('close-toc-btn');
let isTocOpen = false;
const fileContextMenu = document.getElementById('file-context-menu');
const contextCopyBtn = document.getElementById('context-copy-btn');
const contextCutBtn = document.getElementById('context-cut-btn');
const contextPasteBtn = document.getElementById('context-paste-btn');
const contextDivider = document.getElementById('context-divider');
const contextRenameBtn = document.getElementById('context-rename-btn');
const contextDeleteBtn = document.getElementById('context-delete-btn');
const shortcutsModal = document.getElementById('shortcuts-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const closeModalFooterBtn = document.getElementById('close-modal-footer-btn');

// File browsing state
let currentBrowsePath = '';
let existingFolders = [];
let fileClipboard = null; // { action: 'copy' | 'cut', sourceRelPath: string, filename: string, isFolder: boolean, el: HTMLElement }
let selectedBrowserItem = null; // { name: string, isFolder: boolean, relPath: string, el: HTMLElement }


// Menu bar actions
const menuNewNotebook = document.getElementById('menu-new-notebook');
const menuSaveNotebook = document.getElementById('menu-save-notebook');
const menuExportMarkdown = document.getElementById('menu-export-markdown');
const menuExportPdf = document.getElementById('menu-export-pdf');
const menuExportHtml = document.getElementById('menu-export-html');
const menuSaveFile = document.getElementById('menu-save-file');
const menuSaveFileAs = document.getElementById('menu-save-file-as');
const menuSplitEditor = document.getElementById('menu-split-editor');
const menuShortcuts = document.getElementById('menu-shortcuts');
const menuDeleteFile = document.getElementById('menu-delete-file');
const menuCopyCell = document.getElementById('menu-copy-cell');
const menuCutCell = document.getElementById('menu-cut-cell');
const menuPasteCellBelow = document.getElementById('menu-paste-cell-below');
const menuPasteCellAbove = document.getElementById('menu-paste-cell-above');
const menuMergeSelectedCells = document.getElementById('menu-merge-selected-cells');
const menuUndoCell = document.getElementById('menu-undo-cell');
const menuRedoCell = document.getElementById('menu-redo-cell');
const menuSelectAllCells = document.getElementById('menu-select-all-cells');
const menuDeleteCell = document.getElementById('menu-delete-cell');
const menuSplitCell = document.getElementById('menu-split-cell');
const menuRecenterLine = document.getElementById('menu-recenter-line');

// Configure Marked.js
marked.use({
    mangle: false,
    headerIds: false
});

// Initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    initPanes();
    loadFileList();
    setupEventListeners();
    setupDividersResizer();
    updateModeBadge();
    updateStatus();
});

// Initialize Panes and Cache DOM References
function initPanes() {
    for (let i = 0; i < MAX_PANES; i++) {
        const container = document.getElementById(`pane-${i}`);
        panes[i].containerEl = container;
        panes[i].tabsListEl = container.querySelector('.pane-tabs-list');
        panes[i].nameInputEl = container.querySelector('.notebook-name-input');
        panes[i].extLabelEl = container.querySelector('.notebook-ext-label');
        panes[i].saveBtnEl = container.querySelector('.save-btn');
        panes[i].promptBarEl = container.querySelector('.pane-prompt-bar');
        panes[i].cellsListEl = container.querySelector('.cells-list');
        panes[i].cellsScrollEl = container.querySelector('.pane-cells-container');
        panes[i].dropOverlayEl = container.querySelector('.pane-drop-overlay');
        panes[i].closeBtnEl = container.querySelector('.btn-close-pane');
        panes[i].splitBtnEl = container.querySelector('.btn-split-pane');

        const paneIdx = i;

        // Pane click activates pane
        container.addEventListener('mousedown', () => {
            if (activePaneIndex !== paneIdx) {
                const curDoc = getActiveDocument();
                if (curDoc) {
                    syncDocEditingState(curDoc);
                }
                setActivePane(paneIdx);
            }
        });

        // Tab bar empty space click (outside tabs/buttons)
        const paneTabBar = container.querySelector('.pane-tab-bar');
        if (paneTabBar) {
            paneTabBar.addEventListener('click', (e) => {
                if (e.target.closest('.pane-tab') || e.target.closest('button')) return;
                setActivePane(paneIdx);
                const doc = getPaneActiveDocument(paneIdx);
                if (doc) {
                    exitEditingCellsInDoc(doc, paneIdx);
                    setDocGlobalMode('command', doc);
                    updateCellHighlights(paneIdx);
                }
            });
        }

        // Margin / empty space click in cellsScrollEl (outside any cell)
        panes[i].cellsScrollEl.addEventListener('click', (e) => {
            if (e.target.closest('.cell')) return;
            setActivePane(paneIdx);
            const doc = getPaneActiveDocument(paneIdx);
            if (doc) {
                exitEditingCellsInDoc(doc, paneIdx);
                setDocGlobalMode('command', doc);
                updateCellHighlights(paneIdx);
            }
        });

        // Header click (outside cells)
        const paneHeader = container.querySelector('.pane-header');
        if (paneHeader) {
            paneHeader.addEventListener('click', (e) => {
                if (e.target.closest('.notebook-name-input') || e.target.closest('button')) return;
                setActivePane(paneIdx);
                const doc = getPaneActiveDocument(paneIdx);
                if (doc) {
                    exitEditingCellsInDoc(doc, paneIdx);
                    setDocGlobalMode('command', doc);
                    updateCellHighlights(paneIdx);
                }
            });
        }

        // Pane new tab button
        const newTabBtn = container.querySelector('.btn-new-tab');
        if (newTabBtn) {
            newTabBtn.addEventListener('mousedown', () => {
                isSwitchingTabOrPane = true;
            });
            newTabBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                setActivePane(paneIdx);
                createNewNotebook();
            });
        }

        // Split button
        if (panes[i].splitBtnEl) {
            panes[i].splitBtnEl.addEventListener('mousedown', () => {
                isSwitchingTabOrPane = true;
            });
            panes[i].splitBtnEl.addEventListener('click', (e) => {
                e.stopPropagation();
                setActivePane(paneIdx);
                splitPaneVertically();
            });
        }

        // Close button
        if (panes[i].closeBtnEl) {
            panes[i].closeBtnEl.addEventListener('click', (e) => {
                e.stopPropagation();
                closePane(paneIdx);
            });
        }

        // Save button
        panes[i].saveBtnEl.addEventListener('click', (e) => {
            e.stopPropagation();
            setActivePane(paneIdx);
            saveNotebook();
        });

        // Name input in pane-header (single click to edit, Enter to confirm, Escape to cancel)
        panes[i].nameInputEl.addEventListener('click', (e) => {
            e.stopPropagation();
            setActivePane(paneIdx);
            panes[i].nameInputEl.dataset.isEditing = 'true';
            if (cellStateBeforeRename === null) {
                saveCellStateBeforeRename(paneIdx);
            }
            panes[i].nameInputEl.select();
        });

        panes[i].nameInputEl.addEventListener('focus', () => {
            setActivePane(paneIdx);
            panes[i].nameInputEl.dataset.isEditing = 'true';
            if (cellStateBeforeRename === null) {
                saveCellStateBeforeRename(paneIdx);
            }
            setTimeout(() => {
                panes[i].nameInputEl.select();
            }, 30);
        });

        panes[i].nameInputEl.addEventListener('beforeinput', (e) => {
            if (e.inputType === 'historyUndo' || e.inputType === 'historyRedo') {
                if (panes[i].nameInputEl.dataset.isEditing !== 'true' || document.activeElement !== panes[i].nameInputEl) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }
        });

        panes[i].nameInputEl.addEventListener('input', () => {
            const doc = getPaneActiveDocument(paneIdx);
            if (!doc) return;
            if (panes[i].nameInputEl.dataset.isEditing !== 'true' || document.activeElement !== panes[i].nameInputEl) {
                if (panes[i].nameInputEl.value !== doc.filename) {
                    panes[i].nameInputEl.value = doc.filename;
                }
            }
        });

        panes[i].nameInputEl.addEventListener('keydown', async (e) => {
            if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (e.key.toLowerCase() === 'z' || e.code === 'KeyZ')) {
                if (panes[i].nameInputEl.dataset.isEditing !== 'true') {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
            }

            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();

                const doc = getPaneActiveDocument(paneIdx);
                if (!doc) return;

                const newName = panes[i].nameInputEl.value.trim();
                const oldName = doc.filename;

                if (!newName) {
                    alert('Filename cannot be empty.');
                    panes[i].nameInputEl.dataset.isEditing = 'false';
                    panes[i].nameInputEl.value = oldName;
                    panes[i].nameInputEl.defaultValue = oldName;
                    panes[i].nameInputEl.blur();
                    restoreCellStateAfterRename();
                    return;
                }

                if (newName !== oldName) {
                    const oldWithExt = oldName.endsWith('.md') ? oldName : oldName + '.md';
                    const newWithExt = newName.endsWith('.md') ? newName : newName + '.md';
                    const oldRel = doc.relPath || (doc.dirPath ? `${doc.dirPath}/${oldWithExt}` : oldWithExt);
                    const newRel = doc.dirPath ? `${doc.dirPath}/${newWithExt}` : newWithExt;

                    const result = await renameOnServer(oldRel, newRel, false, true);
                    if (result.success) {
                        doc.filename = newName.replace(/\.md$/, '');
                        doc.relPath = newRel;
                        if (doc.dirPath) {
                            // keep doc.dirPath
                        }
                        updateDocumentFilename(oldName, doc.filename, oldRel, newRel, doc.id);
                        await loadFileList();
                    } else if (result.error && (result.error.includes('Source not found') || result.error.includes('404'))) {
                        // Document was not yet saved to disk
                        doc.filename = newName.replace(/\.md$/, '');
                        doc.relPath = newRel;
                        markModified(true, doc);
                        updateDocumentFilename(oldName, doc.filename, oldRel, newRel, doc.id);
                    } else {
                        panes[i].nameInputEl.value = oldName;
                    }
                }

                panes[i].nameInputEl.dataset.isEditing = 'false';
                panes[i].nameInputEl.defaultValue = doc.filename;
                panes[i].nameInputEl.value = doc.filename;
                panes[i].nameInputEl.blur();
                restoreCellStateAfterRename();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                const doc = getPaneActiveDocument(paneIdx);
                if (doc) {
                    panes[i].nameInputEl.value = doc.filename;
                    panes[i].nameInputEl.defaultValue = doc.filename;
                }
                panes[i].nameInputEl.dataset.isEditing = 'false';
                panes[i].nameInputEl.blur();
                restoreCellStateAfterRename();
            }
        });

        panes[i].nameInputEl.addEventListener('blur', () => {
            panes[i].nameInputEl.dataset.isEditing = 'false';
            setTimeout(() => {
                const doc = getPaneActiveDocument(paneIdx);
                if (cellStateBeforeRename && cellStateBeforeRename.paneIdx === paneIdx) {
                    if (doc) {
                        panes[i].nameInputEl.value = doc.filename;
                        panes[i].nameInputEl.defaultValue = doc.filename;
                    }
                    cellStateBeforeRename = null;
                } else if (doc) {
                    panes[i].nameInputEl.value = doc.filename;
                    panes[i].nameInputEl.defaultValue = doc.filename;
                }
            }, 250);
        });

        // Pane drop events for moving/splitting tabs
        setupPaneDropEvents(paneIdx);
        // Tabs list drop events for reordering tabs
        setupTabsListDropEvents(paneIdx);
    }
}

// Generate unique ID for cells and documents
function generateId() {
    return 'cell-' + Math.random().toString(36).substr(2, 9);
}

function generateDocId() {
    return 'doc-' + Math.random().toString(36).substr(2, 9);
}

// Create a new Document Model
function createDocumentModel(filename = 'untitled', content = '', isNew = false, relPath = '', dirPath = '') {
    let cellContents = [];
    if (content && content.includes('<!-- cell -->')) {
        cellContents = content.split('<!-- cell -->').map(c => c.trim());
    } else if (content && content.trim().length > 0) {
        cellContents = [content];
    } else {
        cellContents = [''];
    }

    const docId = generateDocId();
    const docCells = cellContents.map(c => ({
        id: generateId(),
        content: c,
        mode: isNew ? 'edit' : 'view'
    }));

    const baseName = filename.replace(/\.md$/, '');
    const determinedDirPath = dirPath !== '' ? dirPath : (relPath.includes('/') ? relPath.substring(0, relPath.lastIndexOf('/')) : currentBrowsePath);
    const determinedRelPath = relPath || (determinedDirPath ? `${determinedDirPath}/${baseName}.md` : `${baseName}.md`);

    return {
        id: docId,
        filename: baseName,
        relPath: determinedRelPath,
        dirPath: determinedDirPath,
        cells: docCells,
        activeIndex: 0,
        globalMode: isNew ? 'edit' : 'command',
        isModified: isNew,
        selectedIndices: [],
        selectionAnchorIndex: -1,
        undoStack: [],
        redoStack: [],
        dKeyPressCount: 0,
        gKeyPressCount: 0,
        numberBuffer: ''
    };
}

// File type detection and icon helpers
function getFileType(filename) {
    if (!filename) return 'other';
    const lastDot = filename.lastIndexOf('.');
    const ext = lastDot !== -1 ? filename.substring(lastDot + 1).toLowerCase() : '';
    if (['md', 'markdown'].includes(ext)) {
        return 'notebook';
    }
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico'].includes(ext)) {
        return 'image';
    }
    if (ext === 'pdf') {
        return 'pdf';
    }
    if (['txt', 'py', 'js', 'json', 'html', 'htm', 'css', 'ts', 'jsx', 'tsx', 'sh', 'yaml', 'yml', 'xml', 'csv', 'tsv', 'sql', 'log', 'ini', 'toml', 'env', 'rs', 'go', 'c', 'cpp', 'h', 'hpp', 'java'].includes(ext)) {
        return 'text';
    }
    if (['mp4', 'webm', 'ogg', 'mov'].includes(ext)) {
        return 'video';
    }
    if (['mp3', 'wav', 'aac', 'flac', 'm4a'].includes(ext)) {
        return 'audio';
    }
    return 'other';
}

function getFileIconClass(filename) {
    const type = getFileType(filename);
    const lastDot = filename ? filename.lastIndexOf('.') : -1;
    const ext = lastDot !== -1 ? filename.substring(lastDot + 1).toLowerCase() : '';
    switch (type) {
        case 'notebook':
            return 'fa-regular fa-file-lines text-jupyter-blue';
        case 'image':
            return 'fa-regular fa-file-image text-emerald-500';
        case 'pdf':
            return 'fa-regular fa-file-pdf text-red-500';
        case 'video':
            return 'fa-regular fa-file-video text-purple-500';
        case 'audio':
            return 'fa-regular fa-file-audio text-amber-500';
        case 'text':
            if (['py', 'js', 'ts', 'jsx', 'tsx', 'html', 'htm', 'css', 'json', 'sh', 'sql', 'yaml', 'yml', 'rs', 'go', 'c', 'cpp', 'java'].includes(ext)) {
                return 'fa-regular fa-file-code text-indigo-500';
            }
            if (['csv', 'tsv'].includes(ext)) {
                return 'fa-regular fa-file-excel text-green-600';
            }
            return 'fa-regular fa-file-lines text-gray-500';
        default:
            if (['zip', 'tar', 'gz', 'bz2', '7z', 'rar'].includes(ext)) {
                return 'fa-regular fa-file-zipper text-amber-600';
            }
            return 'fa-regular fa-file text-gray-400';
    }
}

// Create a Document Model for non-notebook viewer documents (images, PDFs, text, media)
function createViewerDocumentModel(filename, relPath = '', dirPath = '', fileType = 'text', content = '') {
    const docId = generateDocId();
    const determinedDirPath = dirPath !== '' ? dirPath : (relPath.includes('/') ? relPath.substring(0, relPath.lastIndexOf('/')) : currentBrowsePath);
    const determinedRelPath = relPath || (determinedDirPath ? `${determinedDirPath}/${filename}` : filename);

    return {
        id: docId,
        filename: filename,
        relPath: determinedRelPath,
        dirPath: determinedDirPath,
        fileType: fileType,
        content: content,
        cells: [],
        activeIndex: 0,
        globalMode: 'command',
        isModified: false,
        selectedIndices: [],
        selectionAnchorIndex: -1,
        undoStack: [],
        redoStack: [],
        dKeyPressCount: 0,
        gKeyPressCount: 0,
        numberBuffer: ''
    };
}

// Active Pane & Document Getters
function getActivePane() {
    return panes[activePaneIndex];
}

function getPaneActiveDocument(paneIdx) {
    const pane = panes[paneIdx];
    if (!pane || !pane.activeTabId) return null;
    return documents.get(pane.activeTabId) || null;
}

function getActiveDocument() {
    return getPaneActiveDocument(activePaneIndex);
}

// State tracker for renaming operations to restore cell focus/edit mode
let cellStateBeforeRename = null;
let isInlineRenaming = false;

function saveCellStateBeforeRename(paneIdx = activePaneIndex) {
    const doc = getPaneActiveDocument(paneIdx);
    if (!doc) {
        cellStateBeforeRename = null;
        return null;
    }

    syncDocEditingState(doc);

    const activeIndex = (doc.activeIndex !== -1 && doc.activeIndex < doc.cells.length) ? doc.activeIndex : 0;
    const activeCell = doc.cells[activeIndex];
    const wasEditing = activeCell ? (activeCell.mode === 'edit') : false;
    let cursorPos = 0;
    if (activeCell) {
        if (activeCell.cursorPos !== undefined && activeCell.cursorPos !== null) {
            cursorPos = activeCell.cursorPos;
        } else {
            const ta = document.getElementById(`textarea-${activeCell.id}`);
            if (ta) {
                try { cursorPos = ta.selectionStart; } catch (e) {}
            }
        }
    }

    cellStateBeforeRename = {
        paneIdx,
        docId: doc.id,
        activeIndex,
        wasEditing,
        cursorPos
    };
    return cellStateBeforeRename;
}

function restoreCellStateAfterRename(state = cellStateBeforeRename) {
    if (!state) return;
    const { paneIdx, docId, activeIndex, wasEditing, cursorPos } = state;
    cellStateBeforeRename = null;
    isInlineRenaming = false;

    setActivePane(paneIdx);
    const doc = getPaneActiveDocument(paneIdx);
    if (!doc || doc.id !== docId || activeIndex < 0 || activeIndex >= doc.cells.length) return;

    if (wasEditing) {
        doc.cells[activeIndex].mode = 'edit';
        setDocGlobalMode('edit', doc);
        if (!document.getElementById(`textarea-${doc.cells[activeIndex].id}`)) {
            renderCellAt(activeIndex, paneIdx);
        }
        selectCell(activeIndex, false, paneIdx);

        setTimeout(() => {
            const textarea = document.getElementById(`textarea-${doc.cells[activeIndex].id}`);
            if (textarea) {
                textarea.focus();
                try {
                    textarea.setSelectionRange(cursorPos, cursorPos);
                } catch (e) {}
                updateCellCaretAndHighlight(textarea, doc.cells[activeIndex].id);
            }
        }, 50);
    } else {
        setDocGlobalMode('command', doc);
        selectCell(activeIndex, false, paneIdx);
    }
}

// Set Active Pane
function setActivePane(paneIdx) {
    if (paneIdx < 0 || paneIdx >= openPaneCount) return;
    activePaneIndex = paneIdx;

    for (let i = 0; i < MAX_PANES; i++) {
        if (panes[i].containerEl) {
            if (i === activePaneIndex) {
                panes[i].containerEl.classList.add('active-pane');
            } else {
                panes[i].containerEl.classList.remove('active-pane');
            }
        }
    }
    updateModeBadge();
    updateStatus();
    if (isTocOpen) {
        renderToc();
    }
}

function focusPane(paneIdx) {
    setActivePane(paneIdx);
    focusActiveCellIfEditing(paneIdx);
}

// Switch Active Pane (with keyboard / programmatic focus change)
function switchActivePane(targetIndex) {
    if (targetIndex < 0 || targetIndex >= openPaneCount || targetIndex === activePaneIndex) return;
    isSwitchingTabOrPane = true;
    const curDoc = getActiveDocument();
    if (curDoc) {
        syncDocEditingState(curDoc);
    }
    setActivePane(targetIndex);
    focusActiveCellIfEditing(targetIndex);
    setTimeout(() => {
        isSwitchingTabOrPane = false;
    }, 150);
}

// Focus active cell's textarea if in edit mode, or select cell in command mode
function focusActiveCellIfEditing(paneIdx = activePaneIndex) {
    const pane = panes[paneIdx];
    const doc = getPaneActiveDocument(paneIdx);
    if (!pane || !doc) return;

    let editingIndex = doc.cells.findIndex(c => c.mode === 'edit');
    if (editingIndex !== -1) {
        doc.globalMode = 'edit';
        doc.activeIndex = editingIndex;
        selectCell(editingIndex, false, paneIdx);
        const activeCell = doc.cells[editingIndex];

        setTimeout(() => {
            const textarea = document.getElementById(`textarea-${activeCell.id}`);
            if (textarea) {
                textarea.focus();
                const pos = (activeCell.cursorPos !== undefined && activeCell.cursorPos !== null)
                    ? Math.min(activeCell.cursorPos, textarea.value.length)
                    : textarea.value.length;
                try {
                    textarea.setSelectionRange(pos, pos);
                } catch (e) {}
                autoResizeTextarea(textarea, paneIdx);
                updateCellCaretAndHighlight(textarea, activeCell.id);
            }
        }, 30);
    } else {
        doc.globalMode = 'command';
        if (document.activeElement && document.activeElement !== document.body && typeof document.activeElement.blur === 'function') {
            document.activeElement.blur();
        }
        if (doc.cells && doc.cells.length > 0) {
            const cellToSelect = (doc.activeIndex >= 0 && doc.activeIndex < doc.cells.length)
                ? doc.activeIndex
                : 0;
            selectCell(cellToSelect, false, paneIdx);
        }
    }
    updateModeBadge();
    updateStatus();
}

// Update Mode Badge (in top header)
function updateModeBadge() {
    const doc = getActiveDocument();
    if (doc && !notebookContainer.classList.contains('hidden')) {
        if (doc.fileType && doc.fileType !== 'notebook') {
            modeBadge.textContent = 'View Mode';
            modeBadge.className = 'bg-teal-600 px-2 py-0.5 rounded text-white font-bold text-xs';
        } else if (doc.globalMode === 'command') {
            modeBadge.textContent = 'Command Mode';
            modeBadge.className = 'bg-jupyter-cmdMode px-2 py-0.5 rounded text-white font-bold text-xs';
        } else {
            modeBadge.textContent = 'Edit Mode';
            modeBadge.className = 'bg-jupyter-blue px-2 py-0.5 rounded text-white font-bold text-xs';
        }
    } else {
        modeBadge.textContent = 'No File';
        modeBadge.className = 'bg-gray-300 px-2 py-0.5 rounded text-gray-700 font-bold text-xs';
    }
}

// Update Saved / Unsaved Status (in top header)
function updateStatus() {
    const doc = getActiveDocument();
    if (!doc || notebookContainer.classList.contains('hidden')) {
        notebookStatus.textContent = '';
        return;
    }
    if (doc.fileType && doc.fileType !== 'notebook') {
        notebookStatus.textContent = '';
        return;
    }
    if (doc.isModified) {
        notebookStatus.textContent = 'Unsaved changes';
        notebookStatus.className = 'text-amber-600 font-semibold';
    } else {
        notebookStatus.textContent = 'Saved';
        notebookStatus.className = 'text-green-600';
    }
}

// Mark modified status for a document
function markModified(modified, targetDoc = null) {
    const doc = targetDoc || getActiveDocument();
    if (!doc) return;
    doc.isModified = modified;
    if (doc === getActiveDocument()) {
        updateStatus();
    }
    for (let i = 0; i < openPaneCount; i++) {
        if (panes[i].tabs.includes(doc.id)) {
            renderTabs(i);
        }
    }
}

// Render tabs for a specific pane
function renderTabs(paneIdx) {
    const pane = panes[paneIdx];
    if (!pane) return;
    const tabsListEl = pane.tabsListEl;
    if (!tabsListEl) return;
    tabsListEl.innerHTML = '';

    pane.tabs.forEach(docId => {
        const doc = documents.get(docId);
        if (!doc) return;

        const isNotebook = !doc.fileType || doc.fileType === 'notebook';
        const fileIconClass = isNotebook ? 'fa-regular fa-file-lines' : getFileIconClass(doc.filename);
        const isActive = (docId === pane.activeTabId);
        const tabEl = document.createElement('div');
        tabEl.className = `pane-tab ${isActive ? 'active' : ''}`;
        tabEl.setAttribute('draggable', 'true');
        tabEl.setAttribute('data-tab-id', docId);
        tabEl.setAttribute('data-pane-id', paneIdx);

        const hasDuplicateName = Array.from(documents.values()).some(d => d.id !== doc.id && d.filename === doc.filename);
        const dirHint = hasDuplicateName && doc.dirPath ? `<span class="text-[10px] text-gray-400 font-mono ml-1 truncate max-w-[80px]" title="${doc.dirPath}">${doc.dirPath}/</span>` : (hasDuplicateName && !doc.dirPath ? `<span class="text-[10px] text-gray-400 font-mono ml-1" title="Root folder">/</span>` : '');
        const extSpan = isNotebook ? '<span class="text-gray-400 text-xs font-mono ml-0.5">.md</span>' : '';

        tabEl.innerHTML = `
            <i class="${fileIconClass} text-xs mr-1.5 ${isActive ? 'text-jupyter-blue' : 'text-gray-400'}"></i>
            <span class="pane-tab-title" title="${doc.relPath || (isNotebook ? doc.filename + '.md' : doc.filename)}">${doc.filename}</span>
            ${extSpan}
            ${dirHint}
            ${doc.isModified ? '<span class="tab-modified-dot" title="Unsaved changes"></span>' : ''}
            <span class="pane-tab-close ml-2" title="Close Tab">
                <i class="fa-solid fa-xmark text-[10px]"></i>
            </span>
        `;

        // Tab mousedown: set guard so textarea blur doesn't switch cell to command mode
        tabEl.addEventListener('mousedown', (e) => {
            if (e.target.closest('.pane-tab-close')) return;
            isSwitchingTabOrPane = true;
        });

        // Click to switch tab
        tabEl.addEventListener('click', (e) => {
            if (e.target.closest('.pane-tab-close')) return;
            switchTab(paneIdx, docId);
        });

        // Close button
        const closeBtn = tabEl.querySelector('.pane-tab-close');
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeTab(paneIdx, docId);
        });

        // Attach tab drag events
        attachTabDragEvents(tabEl, docId, paneIdx);

        tabsListEl.appendChild(tabEl);
    });
}

// Sync any editing cells in doc to model without exiting edit mode
function syncDocEditingState(doc) {
    if (!doc) return;
    doc.cells.forEach(cell => {
        if (cell.mode === 'edit') {
            const textarea = document.getElementById(`textarea-${cell.id}`);
            if (textarea) {
                cell.content = textarea.value;
                try {
                    cell.cursorPos = textarea.selectionStart;
                } catch (e) {}
            }
        }
    });
}

// Exit edit mode for a specific cell in doc and render as view mode
function exitEditingCell(cellIndex, doc = getActiveDocument(), paneIdx = activePaneIndex) {
    if (!doc || cellIndex < 0 || cellIndex >= doc.cells.length) return;
    const cell = doc.cells[cellIndex];
    if (activePromptState && String(activePromptState.cellId) === String(cell.id)) {
        closePromptBar(paneIdx);
    }
    if (cell.mode === 'edit') {
        const textarea = document.getElementById(`textarea-${cell.id}`);
        if (textarea) {
            cell.content = textarea.value;
            try {
                cell.cursorPos = textarea.selectionStart;
            } catch (e) {}
        }
        cell.mode = 'view';
        renderCellAt(cellIndex, paneIdx);
        setDocGlobalMode('command', doc);
    }
}

// Exit edit mode for any editing cells in doc
function exitEditingCellsInDoc(doc = getActiveDocument(), paneIdx = activePaneIndex) {
    if (!doc) return;
    doc.cells.forEach((cell, idx) => {
        if (cell.mode === 'edit') {
            exitEditingCell(idx, doc, paneIdx);
        }
    });
}

// Switch active tab in a pane
function switchTab(paneIdx, docId) {
    const pane = panes[paneIdx];
    if (!pane.tabs.includes(docId)) return;

    closePromptBar(paneIdx);
    isSwitchingTabOrPane = true;

    const prevDoc = getPaneActiveDocument(paneIdx);
    if (prevDoc) {
        syncDocEditingState(prevDoc);
    }

    pane.activeTabId = docId;
    setActivePane(paneIdx);
    renderPane(paneIdx);

    focusActiveCellIfEditing(paneIdx);

    setTimeout(() => {
        isSwitchingTabOrPane = false;
    }, 150);
}

// Switch to next or previous tab in active pane
function switchTabInActivePane(direction) {
    const pane = getActivePane();
    if (!pane || !pane.tabs || pane.tabs.length <= 1) return;

    const currentIdx = pane.tabs.indexOf(pane.activeTabId);
    if (currentIdx === -1) return;

    let targetIdx = -1;
    if (direction === 'left') {
        if (currentIdx > 0) {
            targetIdx = currentIdx - 1;
        }
    } else if (direction === 'right') {
        if (currentIdx < pane.tabs.length - 1) {
            targetIdx = currentIdx + 1;
        }
    }

    if (targetIdx !== -1) {
        isSwitchingTabOrPane = true;
        const targetDocId = pane.tabs[targetIdx];
        switchTab(activePaneIndex, targetDocId);
        const activeTabEl = pane.tabsListEl ? pane.tabsListEl.querySelector(`.pane-tab[data-tab-id="${targetDocId}"]`) : null;
        if (activeTabEl) {
            activeTabEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        }
    }
}

// Close a tab
function closeTab(paneIdx, docId) {
    const doc = documents.get(docId);
    if (!doc) return;

    if (doc.isModified) {
        checkUnsavedChangesForDoc(doc, () => {
            performCloseTab(paneIdx, docId);
        });
    } else {
        performCloseTab(paneIdx, docId);
    }
}

// Helper: actually remove tab
function performCloseTab(paneIdx, docId) {
    const pane = panes[paneIdx];
    const tabIndex = pane.tabs.indexOf(docId);
    if (tabIndex === -1) return;

    pane.tabs.splice(tabIndex, 1);

    if (pane.activeTabId === docId) {
        if (pane.tabs.length > 0) {
            const nextIndex = Math.min(tabIndex, pane.tabs.length - 1);
            pane.activeTabId = pane.tabs[nextIndex];
        } else {
            pane.activeTabId = null;
        }
    }

    // Check if doc is opened in any other pane, if not delete from documents
    let openedElsewhere = false;
    for (let i = 0; i < openPaneCount; i++) {
        if (panes[i].tabs.includes(docId)) openedElsewhere = true;
    }
    if (!openedElsewhere) {
        documents.delete(docId);
    }

    checkEmptyPanes();

    if (pane.tabs.length > 0) {
        renderPane(paneIdx);
    }
}

// Update Pane Visibility & Divider States based on openPaneCount
function updatePanesLayout() {
    for (let i = 0; i < MAX_PANES; i++) {
        const isOpen = (i < openPaneCount);
        if (panes[i].containerEl) {
            if (isOpen) {
                panes[i].containerEl.classList.remove('hidden');
                panes[i].containerEl.style.flex = '1 1 0%';
                // Show close button if openPaneCount > 1
                if (panes[i].closeBtnEl) {
                    if (openPaneCount > 1) {
                        panes[i].closeBtnEl.classList.remove('hidden');
                    } else {
                        panes[i].closeBtnEl.classList.add('hidden');
                    }
                }
                // Show split button if openPaneCount < MAX_PANES
                if (panes[i].splitBtnEl) {
                    if (openPaneCount < MAX_PANES) {
                        panes[i].splitBtnEl.classList.remove('hidden');
                    } else {
                        panes[i].splitBtnEl.classList.add('hidden');
                    }
                }
            } else {
                panes[i].containerEl.classList.add('hidden');
                panes[i].tabs = [];
                panes[i].activeTabId = null;
            }
        }
    }

    // Dividers: divider-0 is between pane-0 and pane-1, divider-1 is between pane-1 and pane-2
    const divider0 = document.getElementById('divider-0');
    const divider1 = document.getElementById('divider-1');
    if (divider0) {
        if (openPaneCount >= 2) divider0.classList.remove('hidden');
        else divider0.classList.add('hidden');
    }
    if (divider1) {
        if (openPaneCount >= 3) divider1.classList.remove('hidden');
        else divider1.classList.add('hidden');
    }

    if (activePaneIndex >= openPaneCount) {
        activePaneIndex = Math.max(0, openPaneCount - 1);
    }
    setActivePane(activePaneIndex);
    updateDummyCellsHeight();
}

// Check and handle empty panes (auto-close empty panes and shift remaining left)
function checkEmptyPanes() {
    let anyClosed = false;

    // Check from right to left or left to right
    let i = 0;
    while (i < openPaneCount) {
        if (panes[i].tabs.length === 0) {
            if (openPaneCount === 1) {
                // All panes empty
                closeNotebookWorkspace();
                return;
            }
            // Shift remaining panes left
            for (let j = i; j < openPaneCount - 1; j++) {
                panes[j].tabs = [...panes[j + 1].tabs];
                panes[j].activeTabId = panes[j + 1].activeTabId;
            }
            panes[openPaneCount - 1].tabs = [];
            panes[openPaneCount - 1].activeTabId = null;

            openPaneCount--;
            anyClosed = true;
            // Don't increment i, check the shifted one
        } else {
            i++;
        }
    }

    updatePanesLayout();

    for (let p = 0; p < openPaneCount; p++) {
        renderPane(p);
    }
}

// Close a specific pane (merges its tabs to an adjacent pane)
function closePane(paneIdx) {
    if (openPaneCount <= 1) return;

    const targetMergeIdx = (paneIdx === 0) ? 1 : paneIdx - 1;
    panes[paneIdx].tabs.forEach(tabId => {
        if (!panes[targetMergeIdx].tabs.includes(tabId)) {
            panes[targetMergeIdx].tabs.push(tabId);
        }
    });

    // Shift left to fill the gap
    for (let j = paneIdx; j < openPaneCount - 1; j++) {
        panes[j].tabs = [...panes[j + 1].tabs];
        panes[j].activeTabId = panes[j + 1].activeTabId;
    }
    panes[openPaneCount - 1].tabs = [];
    panes[openPaneCount - 1].activeTabId = null;

    openPaneCount--;
    updatePanesLayout();

    activePaneIndex = Math.min(activePaneIndex, openPaneCount - 1);
    setActivePane(activePaneIndex);

    for (let p = 0; p < openPaneCount; p++) {
        renderPane(p);
    }
}

// Merge the active pane into its adjacent left pane (Ctrl + Alt + M)
function mergeLastPane() {
    if (openPaneCount <= 1) return;
    // Only perform merge when pane 2 or pane 3 is active (pane 1 active -> no-op)
    if (activePaneIndex === 0) return;

    // Sync editing state before merging panes
    for (const [docId, doc] of documents.entries()) {
        syncDocEditingState(doc);
    }

    const sourceIdx = activePaneIndex;
    const targetIdx = activePaneIndex - 1;
    const sourcePane = panes[sourceIdx];
    const targetPane = panes[targetIdx];
    const sourceActiveTab = sourcePane.activeTabId;

    // Merge tabs from sourcePane to targetPane without duplicates
    sourcePane.tabs.forEach(tabId => {
        if (!targetPane.tabs.includes(tabId)) {
            targetPane.tabs.push(tabId);
        }
    });

    // In targetPane, activate the tab from sourcePane that was active
    if (sourceActiveTab && targetPane.tabs.includes(sourceActiveTab)) {
        targetPane.activeTabId = sourceActiveTab;
    } else if (!targetPane.activeTabId && targetPane.tabs.length > 0) {
        targetPane.activeTabId = targetPane.tabs[0];
    }

    // Shift any panes to the right of sourceIdx to the left
    for (let j = sourceIdx; j < openPaneCount - 1; j++) {
        panes[j].tabs = [...panes[j + 1].tabs];
        panes[j].activeTabId = panes[j + 1].activeTabId;
    }

    // Clear the trailing pane slot
    panes[openPaneCount - 1].tabs = [];
    panes[openPaneCount - 1].activeTabId = null;

    openPaneCount--;
    activePaneIndex = targetIdx;

    updatePanesLayout();

    for (let p = 0; p < openPaneCount; p++) {
        renderPane(p);
    }

    setActivePane(activePaneIndex);
    focusActiveCellIfEditing(activePaneIndex);
}

// Render an entire pane (tabs, header, and cells)
function renderPane(paneIdx) {
    const pane = panes[paneIdx];
    renderTabs(paneIdx);

    const doc = getPaneActiveDocument(paneIdx);
    if (!doc) {
        pane.nameInputEl.value = '';
        pane.cellsListEl.innerHTML = '';
        if (pane.extLabelEl) {
            pane.extLabelEl.style.display = 'none';
        }
        return;
    }

    const isNotebook = !doc.fileType || doc.fileType === 'notebook';
    pane.nameInputEl.value = doc.filename;

    if (pane.saveBtnEl) {
        pane.saveBtnEl.style.display = isNotebook ? '' : 'none';
    }
    if (pane.nameInputEl) {
        pane.nameInputEl.readOnly = !isNotebook;
    }
    if (pane.extLabelEl) {
        pane.extLabelEl.style.display = isNotebook ? '' : 'none';
    }

    if (!isNotebook) {
        renderFileViewer(paneIdx, doc);
    } else {
        renderCells(paneIdx);
    }
    updateModeBadge();
    updateStatus();
    setTimeout(() => updatePaneScrollMarkers(paneIdx), 50);
}

// Render non-notebook file viewer (images, PDFs, text/code, media)
function renderFileViewer(paneIdx, doc) {
    const pane = panes[paneIdx];
    if (!pane || !doc) return;

    pane.cellsListEl.innerHTML = '';

    const container = document.createElement('div');
    container.className = 'w-full h-full flex flex-col p-4 space-y-3';

    const rawUrl = `/api/raw-file?path=${encodeURIComponent(doc.relPath).replace(/%2F/g, '/')}`;

    // Toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'flex items-center justify-between pb-2 border-b border-gray-200 text-xs text-gray-600 flex-shrink-0';

    const infoSpan = document.createElement('div');
    infoSpan.className = 'flex items-center space-x-2';
    infoSpan.innerHTML = `
        <span class="font-semibold text-gray-800">${escapeHtml(doc.filename)}</span>
        <span class="px-2 py-0.5 rounded bg-gray-100 text-gray-500 uppercase text-[10px] tracking-wider font-mono">${escapeHtml(doc.fileType)}</span>
    `;

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'flex items-center space-x-2';

    const openExternalBtn = document.createElement('a');
    openExternalBtn.href = rawUrl;
    openExternalBtn.target = '_blank';
    openExternalBtn.rel = 'noopener noreferrer';
    openExternalBtn.className = 'px-2.5 py-1 text-xs text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50 hover:text-gray-900 transition-colors inline-flex items-center space-x-1';
    openExternalBtn.innerHTML = '<i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i><span>Open in Browser</span>';

    const downloadBtn = document.createElement('a');
    downloadBtn.href = rawUrl;
    downloadBtn.download = doc.filename;
    downloadBtn.className = 'px-2.5 py-1 text-xs text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50 hover:text-gray-900 transition-colors inline-flex items-center space-x-1';
    downloadBtn.innerHTML = '<i class="fa-solid fa-download text-[10px]"></i><span>Download</span>';

    actionsDiv.appendChild(openExternalBtn);
    actionsDiv.appendChild(downloadBtn);
    toolbar.appendChild(infoSpan);
    toolbar.appendChild(actionsDiv);
    container.appendChild(toolbar);

    // Viewer body
    const bodyEl = document.createElement('div');

    if (doc.fileType === 'image') {
        bodyEl.className = 'flex-1 overflow-auto rounded border border-gray-200 bg-slate-100/80 p-4 flex items-center justify-center min-h-[400px]';
        const img = document.createElement('img');
        img.src = rawUrl;
        img.alt = doc.filename;
        img.className = 'max-w-full max-h-[calc(100vh-250px)] object-contain rounded shadow-sm bg-white';
        bodyEl.appendChild(img);
    } else if (doc.fileType === 'pdf') {
        bodyEl.className = 'flex-1 w-full h-[calc(100vh-230px)] rounded border border-gray-200 overflow-hidden';
        const iframe = document.createElement('iframe');
        iframe.src = rawUrl;
        iframe.className = 'w-full h-full border-0';
        bodyEl.appendChild(iframe);
    } else if (doc.fileType === 'video') {
        bodyEl.className = 'flex-1 overflow-auto rounded border border-gray-200 bg-black/90 p-4 flex items-center justify-center min-h-[400px]';
        const video = document.createElement('video');
        video.src = rawUrl;
        video.controls = true;
        video.className = 'max-w-full max-h-[calc(100vh-250px)] rounded shadow';
        bodyEl.appendChild(video);
    } else if (doc.fileType === 'audio') {
        bodyEl.className = 'flex-1 overflow-auto rounded border border-gray-200 bg-white p-8 flex flex-col items-center justify-center space-y-4 min-h-[300px]';
        bodyEl.innerHTML = `
            <i class="fa-solid fa-music text-4xl text-amber-500 mb-2"></i>
            <div class="text-sm font-medium text-gray-700">${escapeHtml(doc.filename)}</div>
            <audio controls src="${rawUrl}" class="w-full max-w-md"></audio>
        `;
    } else if (doc.fileType === 'text') {
        bodyEl.className = 'flex-1 overflow-auto rounded border border-gray-200 bg-white p-4 font-mono text-xs leading-relaxed text-gray-800 select-text whitespace-pre block max-h-[calc(100vh-230px)]';
        bodyEl.textContent = doc.content;
    } else {
        bodyEl.className = 'flex-1 overflow-auto rounded border border-gray-200 bg-gray-50 min-h-[300px] flex items-center justify-center';
        bodyEl.innerHTML = `
            <div class="text-center p-8 space-y-2">
                <i class="fa-regular fa-file text-5xl text-gray-400"></i>
                <div class="text-sm font-medium text-gray-700">${escapeHtml(doc.filename)}</div>
                <div class="text-xs text-gray-400">No preview available</div>
            </div>
        `;
    }

    container.appendChild(bodyEl);
    pane.cellsListEl.appendChild(container);
}

// Show/Hide Workspace
function showNotebookWorkspace() {
    emptyState.classList.add('hidden');
    notebookContainer.classList.remove('hidden');
    setTimeout(() => {
        for (let p = 0; p < openPaneCount; p++) {
            updatePaneScrollMarkers(p);
        }
    }, 50);
}

function closeNotebookWorkspace() {
    emptyState.classList.remove('hidden');
    notebookContainer.classList.add('hidden');
    updateModeBadge();
    updateStatus();
}

// Sync editing textareas to doc model (without exiting edit mode)
function syncEditingTextareas(doc) {
    syncDocEditingState(doc);
}

// Update height of all dummy cells across panes (half of container height)
function updateDummyCellsHeight() {
    for (let i = 0; i < openPaneCount; i++) {
        const pane = panes[i];
        if (!pane || !pane.cellsScrollEl) continue;
        const dummy = pane.cellsScrollEl.querySelector('.dummy-cell');
        if (dummy) {
            const containerH = pane.cellsScrollEl.clientHeight || (notebookContainer ? notebookContainer.clientHeight : 0);
            if (containerH > 0) {
                const halfH = Math.round(containerH / 2);
                dummy.style.height = `${halfH}px`;
                dummy.style.minHeight = `${halfH}px`;
            }
        }
    }
}

// Comment Highlight Helpers (TODO: / NOTE: inside <!-- ... -->)
function hasTodoOrNoteComment(content) {
    if (!content) return false;
    const commentRegex = /<!--[\s\S]*?-->/g;
    let match;
    while ((match = commentRegex.exec(content)) !== null) {
        const commentText = match[0];
        if (commentText.includes('TODO:') || commentText.includes('NOTE:')) {
            return true;
        }
    }
    return false;
}

function findExactMatches(text, searchStr) {
    if (!text || !searchStr) return [];
    const matches = [];
    let idx = 0;
    while ((idx = text.indexOf(searchStr, idx)) !== -1) {
        matches.push({
            start: idx,
            end: idx + searchStr.length
        });
        idx += searchStr.length;
    }
    return matches;
}

function renderCommentHighlightBackdrop(text, searchState = null) {
    if (!text) return '';
    let processed = text;
    if (processed.endsWith('\n')) {
        processed += ' ';
    }

    if (!searchState || !searchState.oldText) {
        const escaped = processed
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        return escaped.replace(/(&lt;!--[\s\S]*?--&gt;)/g, (commentMatch) => {
            return commentMatch.replace(/\b(TODO:|NOTE:)/g, '<mark class="comment-keyword-mark">$1</mark>');
        });
    }

    const searchStr = searchState.oldText;
    const matches = findExactMatches(processed, searchStr);
    if (matches.length === 0) {
        const escaped = processed
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        return escaped.replace(/(&lt;!--[\s\S]*?--&gt;)/g, (commentMatch) => {
            return commentMatch.replace(/\b(TODO:|NOTE:)/g, '<mark class="comment-keyword-mark">$1</mark>');
        });
    }

    const currentMatchIdx = (searchState.step === 'confirm' && searchState.currentMatchIdx !== undefined)
        ? searchState.currentMatchIdx
        : -1;

    let resultHtml = '';
    let lastIdx = 0;

    matches.forEach((m, mIdx) => {
        if (m.start > lastIdx) {
            const seg = processed.substring(lastIdx, m.start);
            const segEscaped = seg
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
            resultHtml += segEscaped.replace(/(&lt;!--[\s\S]*?--&gt;)/g, (commentMatch) => {
                return commentMatch.replace(/\b(TODO:|NOTE:)/g, '<mark class="comment-keyword-mark">$1</mark>');
            });
        }
        const matchRaw = processed.substring(m.start, m.end);
        const matchEscaped = matchRaw
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        const isCurrent = (mIdx === currentMatchIdx);
        const markClass = isCurrent ? 'search-match-current' : 'search-match-all';
        resultHtml += `<mark class="${markClass}">${matchEscaped}</mark>`;
        lastIdx = m.end;
    });

    if (lastIdx < processed.length) {
        const seg = processed.substring(lastIdx);
        const segEscaped = seg
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        resultHtml += segEscaped.replace(/(&lt;!--[\s\S]*?--&gt;)/g, (commentMatch) => {
            return commentMatch.replace(/\b(TODO:|NOTE:)/g, '<mark class="comment-keyword-mark">$1</mark>');
        });
    }

    return resultHtml;
}

function updateCommentBackdrop(textarea, cellId) {
    const backdrop = document.getElementById(`comment-backdrop-${cellId}`);
    if (!backdrop) return;
    const searchState = (activePromptState && String(activePromptState.cellId) === String(cellId)) ? activePromptState : null;
    backdrop.innerHTML = renderCommentHighlightBackdrop(textarea.value, searchState);
    backdrop.scrollTop = textarea.scrollTop;
}

function getCellNumberHtml(index, cell, isEditing) {
    const hasComment = hasTodoOrNoteComment(cell.content);
    if (hasComment) {
        return `
            <div class="w-8 flex-shrink-0 text-right text-xs ${isEditing ? 'pt-2' : 'pt-1 select-none'}">
                <span class="cell-number-badge-comment">[${index + 1}]</span>
            </div>
        `;
    } else if (isEditing) {
        return `
            <div class="w-8 flex-shrink-0 text-right text-xs text-jupyter-blue font-semibold pt-2">
                [${index + 1}]
            </div>
        `;
    } else {
        return `
            <div class="w-8 flex-shrink-0 text-right text-xs text-gray-400 pt-1 select-none">
                [${index + 1}]
            </div>
        `;
    }
}

function updatePaneScrollMarkers(paneIdx) {
    if (paneIdx === undefined || paneIdx === null) paneIdx = activePaneIndex;
    const pane = panes[paneIdx];
    if (!pane) return;
    const container = pane.containerEl || pane.container;
    if (!container || container.classList.contains('hidden')) return;

    const markersContainer = document.getElementById(`pane-scrollbar-markers-${paneIdx}`);
    if (!markersContainer) return;

    const scrollEl = pane.cellsScrollEl;
    if (!scrollEl) return;

    const scrollElOffsetTop = scrollEl.offsetTop;
    const clientHeight = scrollEl.clientHeight;
    if (clientHeight <= 0) return;

    markersContainer.style.top = `${scrollElOffsetTop}px`;
    markersContainer.style.height = `${clientHeight}px`;

    const doc = getPaneActiveDocument(paneIdx);
    if (!doc || !doc.cells || doc.cells.length === 0) {
        markersContainer.innerHTML = '';
        return;
    }

    const scrollHeight = Math.max(scrollEl.scrollHeight, clientHeight);
    const scrollRect = scrollEl.getBoundingClientRect();

    let markersHtml = '';
    doc.cells.forEach((cell, idx) => {
        if (!hasTodoOrNoteComment(cell.content)) return;

        const cellEl = document.getElementById(`cell-container-${cell.id}`);
        if (!cellEl) return;

        const cellRect = cellEl.getBoundingClientRect();
        const cellTop = cellRect.top - scrollRect.top + scrollEl.scrollTop;
        const cellCenter = cellTop + Math.min(cellEl.offsetHeight / 2, 40);
        const ratio = Math.max(0, Math.min(1, cellCenter / scrollHeight));
        const topPx = Math.max(2, Math.min(clientHeight - 6, Math.round(ratio * (clientHeight - 6))));

        markersHtml += `<div class="scrollbar-marker-line" style="top: ${topPx}px" data-cell-id="${cell.id}" data-pane-idx="${paneIdx}" title="Jump to cell [${idx + 1}] (TODO/NOTE)"></div>`;
    });

    markersContainer.innerHTML = markersHtml;

    markersContainer.querySelectorAll('.scrollbar-marker-line').forEach(marker => {
        marker.addEventListener('click', (e) => {
            e.stopPropagation();
            const cellId = marker.getAttribute('data-cell-id');
            const targetCell = document.getElementById(`cell-container-${cellId}`);
            if (targetCell && scrollEl) {
                const targetRect = targetCell.getBoundingClientRect();
                const curScrollRect = scrollEl.getBoundingClientRect();
                const targetTop = scrollEl.scrollTop + (targetRect.top - curScrollRect.top) - 40;
                scrollEl.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
            }
        });
    });
}

// Render Cells list for a pane
function renderCells(paneIdx = activePaneIndex) {
    const pane = panes[paneIdx];
    const doc = getPaneActiveDocument(paneIdx);
    if (!pane || !doc) return;

    pane.cellsListEl.innerHTML = '';
    doc.cells.forEach((cell, index) => {
        const cellEl = document.createElement('div');
        cellEl.id = `cell-container-${cell.id}`;
        cellEl.className = `cell border-l-4 border-transparent p-2 transition-all relative rounded-r bg-white hover:bg-slate-50 group`;
        cellEl.setAttribute('data-index', index);
        cellEl.setAttribute('data-pane-id', paneIdx);

        // Click to select
        cellEl.addEventListener('click', (e) => {
            setActivePane(paneIdx);
            if (e.shiftKey) {
                e.preventDefault();
                exitEditingCellsInDoc(doc, paneIdx);
                selectCell(index, true, paneIdx);
            } else {
                const editingIdx = doc.cells.findIndex(c => c.mode === 'edit');
                if (editingIdx !== -1 && editingIdx !== index) {
                    exitEditingCell(editingIdx, doc, paneIdx);
                }

                if (cell.mode === 'edit') {
                    setDocGlobalMode('edit', doc);
                    selectCell(index, false, paneIdx);
                    const textarea = document.getElementById(`textarea-${cell.id}`);
                    if (textarea) {
                        if (document.activeElement !== textarea) {
                            textarea.focus();
                            const pos = (cell.cursorPos !== undefined && cell.cursorPos !== null)
                                ? Math.min(cell.cursorPos, textarea.value.length)
                                : textarea.value.length;
                            try {
                                textarea.setSelectionRange(pos, pos);
                            } catch (err) {}
                        }
                    }
                } else {
                    setDocGlobalMode('command', doc);
                    selectCell(index, false, paneIdx);
                }
            }
        });

        // Content layout
        const isEditing = cell.mode === 'edit';
        let innerHTML = '';
        if (isEditing) {
            innerHTML = `
                <div class="flex items-start space-x-2">
                    ${getCellNumberHtml(index, cell, true)}
                    <div class="flex-1">
                        <div class="cell-editor-wrapper relative rounded overflow-hidden bg-slate-50 border border-jupyter-border focus-within:border-jupyter-blue shadow-inner flex">
                            <div id="line-numbers-${cell.id}" class="cell-line-numbers"></div>
                            <div class="relative flex-1 min-w-0">
                                <div id="comment-backdrop-${cell.id}" class="cell-comment-backdrop"></div>
                                <div id="line-highlight-${cell.id}" class="cell-line-highlight hidden"></div>
                                <div id="block-cursor-${cell.id}" class="cell-block-cursor hidden"></div>
                                <textarea id="textarea-${cell.id}" 
                                    class="cell-textarea relative z-10 w-full p-2 font-mono text-sm border-0 focus:outline-none bg-transparent resize-none min-h-[80px]"
                                    placeholder="Type markdown here... (Press Shift+Enter to render, Esc to Command mode)"
                                >${cell.content}</textarea>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } else {
            const renderedHtml = renderMarkdownWithMath(cell.content || '*Empty cell. Double click or press Enter to edit.*', doc.dirPath || '');
            innerHTML = `
                <div class="flex items-start space-x-2">
                    ${getCellNumberHtml(index, cell, false)}
                    <div class="flex-1 markdown-preview px-2 py-1 overflow-x-auto min-h-[30px]" id="preview-${cell.id}">
                        ${renderedHtml}
                    </div>
                </div>
                ${createCellToolbar(index, cell, doc, paneIdx)}
            `;
        }

        cellEl.innerHTML = innerHTML;
        pane.cellsListEl.appendChild(cellEl);

        if (isEditing) {
            const textarea = document.getElementById(`textarea-${cell.id}`);
            attachTextareaEvents(textarea, index, cell, paneIdx);
            setTimeout(() => {
                updateLineNumbers(textarea, cell.id);
                updateCellCaretAndHighlight(textarea, cell.id);
            }, 50);
        } else {
            const previewEl = document.getElementById(`preview-${cell.id}`);
            if (typeof hljs !== 'undefined') {
                previewEl.querySelectorAll('pre code').forEach((block) => {
                    try {
                        hljs.highlightElement(block);
                    } catch (e) {
                        console.error('Highlighting failed:', e);
                    }
                });
            }
            
            previewEl.addEventListener('dblclick', () => {
                setActivePane(paneIdx);
                editCell(index, paneIdx);
            });
        }
    });

    // Append dummy cell at the bottom of the cells list (for scroll adjustment)
    const dummyCell = document.createElement('div');
    dummyCell.className = 'dummy-cell';
    dummyCell.id = `dummy-cell-pane-${paneIdx}`;
    dummyCell.setAttribute('data-dummy-cell', 'true');
    const scrollContainer = pane.cellsScrollEl || notebookContainer;
    const containerH = (scrollContainer && scrollContainer.clientHeight > 0)
        ? scrollContainer.clientHeight
        : (notebookContainer ? notebookContainer.clientHeight : 0);
    if (containerH > 0) {
        const halfH = Math.round(containerH / 2);
        dummyCell.style.height = `${halfH}px`;
        dummyCell.style.minHeight = `${halfH}px`;
    }
    pane.cellsListEl.appendChild(dummyCell);

    updateCellHighlights(paneIdx);
    requestAnimationFrame(() => updatePaneScrollMarkers(paneIdx));
    setTimeout(() => updatePaneScrollMarkers(paneIdx), 40);
}

// Render a single cell to avoid full re-render
function renderCellAt(index, paneIdx = activePaneIndex) {
    const pane = panes[paneIdx];
    const doc = getPaneActiveDocument(paneIdx);
    if (!pane || !doc || index < 0 || index >= doc.cells.length) return;

    const cell = doc.cells[index];
    const cellEl = document.getElementById(`cell-container-${cell.id}`);
    if (!cellEl) return;

    const isEditing = cell.mode === 'edit';
    let innerHTML = '';
    
    if (isEditing) {
        innerHTML = `
            <div class="flex items-start space-x-2">
                ${getCellNumberHtml(index, cell, true)}
                <div class="flex-1">
                    <div class="cell-editor-wrapper relative rounded overflow-hidden bg-slate-50 border border-jupyter-border focus-within:border-jupyter-blue shadow-inner flex">
                        <div id="line-numbers-${cell.id}" class="cell-line-numbers"></div>
                        <div class="relative flex-1 min-w-0">
                            <div id="comment-backdrop-${cell.id}" class="cell-comment-backdrop"></div>
                            <div id="line-highlight-${cell.id}" class="cell-line-highlight hidden"></div>
                            <div id="block-cursor-${cell.id}" class="cell-block-cursor hidden"></div>
                            <textarea id="textarea-${cell.id}" 
                                class="cell-textarea relative z-10 w-full p-2 font-mono text-sm border-0 focus:outline-none bg-transparent resize-none min-h-[80px]"
                                placeholder="Type markdown here... (Press Shift+Enter to render, Esc to Command mode)"
                            >${cell.content}</textarea>
                        </div>
                    </div>
                </div>
            </div>
        `;
    } else {
        const renderedHtml = renderMarkdownWithMath(cell.content || '*Empty cell. Double click or press Enter to edit.*', doc.dirPath || '');
        innerHTML = `
            <div class="flex items-start space-x-2">
                ${getCellNumberHtml(index, cell, false)}
                <div class="flex-1 markdown-preview px-2 py-1 overflow-x-auto min-h-[30px]" id="preview-${cell.id}">
                    ${renderedHtml}
                </div>
            </div>
            ${createCellToolbar(index, cell, doc, paneIdx)}
        `;
    }

    cellEl.innerHTML = innerHTML;

    if (isEditing) {
        const textarea = document.getElementById(`textarea-${cell.id}`);
        attachTextareaEvents(textarea, index, cell, paneIdx);
        setTimeout(() => {
            updateLineNumbers(textarea, cell.id);
            updateCellCaretAndHighlight(textarea, cell.id);
        }, 50);
    } else {
        const previewEl = document.getElementById(`preview-${cell.id}`);
        if (typeof hljs !== 'undefined') {
            previewEl.querySelectorAll('pre code').forEach((block) => {
                try {
                    hljs.highlightElement(block);
                } catch (e) {
                    console.error('Highlighting failed:', e);
                }
            });
        }
        
        previewEl.addEventListener('dblclick', () => {
            setActivePane(paneIdx);
            editCell(index, paneIdx);
        });
    }

    updateCellHighlights(paneIdx);
    requestAnimationFrame(() => updatePaneScrollMarkers(paneIdx));
    setTimeout(() => updatePaneScrollMarkers(paneIdx), 40);
}

// Auto-expand textarea with scroll lock
function autoResizeTextarea(textarea, paneIdx = activePaneIndex) {
    const pane = panes[paneIdx];
    const scrollContainer = pane ? pane.cellsScrollEl : notebookContainer;
    const previousScrollTop = scrollContainer ? scrollContainer.scrollTop : 0;

    textarea.style.height = 'auto';
    textarea.style.height = (textarea.scrollHeight + 4) + 'px';

    if (scrollContainer) {
        scrollContainer.scrollTop = previousScrollTop;
    }
}

// Toggle HTML comments in textarea
function toggleComment(textarea) {
    const text = textarea.value;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    let lineEnd = text.indexOf('\n', end);
    if (lineEnd === -1) {
        lineEnd = text.length;
    }
    
    const selectedLines = text.substring(lineStart, lineEnd);
    const lines = selectedLines.split('\n');
    
    const allCommented = lines.every(line => {
        const trimmed = line.trim();
        return trimmed === '' || (trimmed.startsWith('<!--') && trimmed.endsWith('-->'));
    });
    
    let modifiedLines;
    if (allCommented) {
        modifiedLines = lines.map(line => {
            const match = line.match(/^(\s*)<!--\s?(.*?)\s?-->(\s*)$/);
            if (match) {
                return match[1] + match[2] + match[3];
            }
            return line;
        });
    } else {
        modifiedLines = lines.map(line => {
            if (line.trim() === '') return line;
            const leadingSpaces = line.match(/^\s*/)[0];
            const content = line.substring(leadingSpaces.length);
            return `${leadingSpaces}<!-- ${content} -->`;
        });
    }
    
    const newText = text.substring(0, lineStart) + modifiedLines.join('\n') + text.substring(lineEnd);
    textarea.value = newText;
    
    textarea.selectionStart = lineStart;
    textarea.selectionEnd = lineStart + modifiedLines.join('\n').length;
    textarea.dispatchEvent(new Event('input'));
}

// Helper to get start and end offset of lines encompassed by selection
function getLineRangeForSelection(text, selStart, selEnd) {
    const blockStart = text.lastIndexOf('\n', selStart - 1) + 1;
    let blockEnd;
    if (selStart === selEnd) {
        const nextNl = text.indexOf('\n', selStart);
        blockEnd = (nextNl === -1) ? text.length : nextNl;
    } else {
        if (selEnd > selStart && text[selEnd - 1] === '\n') {
            blockEnd = selEnd - 1;
        } else {
            const nextNl = text.indexOf('\n', selEnd);
            blockEnd = (nextNl === -1) ? text.length : nextNl;
        }
    }
    return { blockStart, blockEnd };
}

// Delete current line or multiple selected lines (Ctrl + Shift + K)
function deleteLineInTextarea(textarea, cell, paneIdx) {
    const text = textarea.value;
    const selStart = textarea.selectionStart;
    const selEnd = textarea.selectionEnd;

    const { blockStart, blockEnd } = getLineRangeForSelection(text, selStart, selEnd);

    let deleteStart = blockStart;
    let deleteEnd = blockEnd;

    if (deleteEnd < text.length && text[deleteEnd] === '\n') {
        deleteEnd += 1;
    } else if (deleteStart > 0 && text[deleteStart - 1] === '\n') {
        deleteStart -= 1;
    }

    textarea.focus();
    textarea.setSelectionRange(deleteStart, deleteEnd);
    let success = false;
    try {
        success = document.execCommand('delete');
    } catch (e) {}

    if (!success) {
        const newText = text.slice(0, deleteStart) + text.slice(deleteEnd);
        textarea.value = newText;
        const newPos = Math.min(deleteStart, newText.length);
        textarea.setSelectionRange(newPos, newPos);
        textarea.dispatchEvent(new Event('input'));
    } else {
        const newPos = Math.min(deleteStart, textarea.value.length);
        textarea.setSelectionRange(newPos, newPos);
        textarea.dispatchEvent(new Event('input'));
    }
    cell.content = textarea.value;
    try {
        cell.cursorPos = textarea.selectionStart;
    } catch (e) {}
}

// Move current line or multiple selected lines up/down within cell (Ctrl + Shift + Up / Down)
function moveLineInTextarea(textarea, cell, paneIdx, direction) {
    const text = textarea.value;
    const selStart = textarea.selectionStart;
    const selEnd = textarea.selectionEnd;

    const { blockStart, blockEnd } = getLineRangeForSelection(text, selStart, selEnd);

    if (direction === 'up') {
        if (blockStart === 0) return; // Top of cell

        const prevLineEnd = blockStart - 1;
        const prevLineStart = text.lastIndexOf('\n', prevLineEnd - 1) + 1;
        const lineAbove = text.substring(prevLineStart, prevLineEnd);
        const selectedBlock = text.substring(blockStart, blockEnd);

        const repText = selectedBlock + '\n' + lineAbove;
        const shift = lineAbove.length + 1;

        textarea.focus();
        textarea.setSelectionRange(prevLineStart, blockEnd);
        let success = false;
        try {
            success = document.execCommand('insertText', false, repText);
        } catch (e) {}

        if (!success) {
            const newText = text.slice(0, prevLineStart) + repText + text.slice(blockEnd);
            textarea.value = newText;
        }

        const newSelStart = selStart - shift;
        const newSelEnd = selEnd - shift;
        textarea.setSelectionRange(newSelStart, newSelEnd);
        textarea.dispatchEvent(new Event('input'));
        cell.content = textarea.value;
        try {
            cell.cursorPos = textarea.selectionStart;
        } catch (e) {}
    } else if (direction === 'down') {
        if (blockEnd === text.length) return; // Bottom of cell

        const nextLineStart = blockEnd + 1;
        let nextLineEnd = text.indexOf('\n', nextLineStart);
        if (nextLineEnd === -1) nextLineEnd = text.length;

        const lineBelow = text.substring(nextLineStart, nextLineEnd);
        const selectedBlock = text.substring(blockStart, blockEnd);

        const repText = lineBelow + '\n' + selectedBlock;
        const shift = lineBelow.length + 1;

        textarea.focus();
        textarea.setSelectionRange(blockStart, nextLineEnd);
        let success = false;
        try {
            success = document.execCommand('insertText', false, repText);
        } catch (e) {}

        if (!success) {
            const newText = text.slice(0, blockStart) + repText + text.slice(nextLineEnd);
            textarea.value = newText;
        }

        const newSelStart = selStart + shift;
        const newSelEnd = selEnd + shift;
        textarea.setSelectionRange(newSelStart, newSelEnd);
        textarea.dispatchEvent(new Event('input'));
        cell.content = textarea.value;
        try {
            cell.cursorPos = textarea.selectionStart;
        } catch (e) {}
    }
}

// Duplicate current line or multiple selected lines below (Ctrl + Shift + D)
function duplicateLineInTextarea(textarea, cell, paneIdx) {
    const text = textarea.value;
    const selStart = textarea.selectionStart;
    const selEnd = textarea.selectionEnd;

    const { blockStart, blockEnd } = getLineRangeForSelection(text, selStart, selEnd);
    const selectedBlock = text.substring(blockStart, blockEnd);
    const insertText = '\n' + selectedBlock;
    const shift = insertText.length;

    textarea.focus();
    textarea.setSelectionRange(blockEnd, blockEnd);
    let success = false;
    try {
        success = document.execCommand('insertText', false, insertText);
    } catch (e) {}

    if (!success) {
        const newText = text.slice(0, blockEnd) + insertText + text.slice(blockEnd);
        textarea.value = newText;
    }

    const newSelStart = selStart + shift;
    const newSelEnd = selEnd + shift;
    textarea.setSelectionRange(newSelStart, newSelEnd);
    textarea.dispatchEvent(new Event('input'));
    cell.content = textarea.value;
    try {
        cell.cursorPos = textarea.selectionStart;
    } catch (e) {}
}

// Wrap selected text or insert delimiters for bold/italic (Ctrl+B, Ctrl+I)
function wrapSelectionInTextarea(textarea, cell, paneIdx, delimiter) {
    const text = textarea.value;
    const selStart = textarea.selectionStart;
    const selEnd = textarea.selectionEnd;
    const dLen = delimiter.length;

    textarea.focus();
    let repText;
    let newSelStart;
    let newSelEnd;

    if (selStart !== selEnd) {
        const selectedText = text.substring(selStart, selEnd);
        repText = delimiter + selectedText + delimiter;
        newSelStart = selStart + dLen;
        newSelEnd = selEnd + dLen;
    } else {
        repText = delimiter + delimiter;
        newSelStart = selStart + dLen;
        newSelEnd = selStart + dLen;
    }

    textarea.setSelectionRange(selStart, selEnd);
    let success = false;
    try {
        success = document.execCommand('insertText', false, repText);
    } catch (e) {}

    if (!success) {
        const newText = text.slice(0, selStart) + repText + text.slice(selEnd);
        textarea.value = newText;
    }

    textarea.setSelectionRange(newSelStart, newSelEnd);
    textarea.dispatchEvent(new Event('input'));
    cell.content = textarea.value;
    try {
        cell.cursorPos = textarea.selectionStart;
    } catch (e) {}
}

// Resolve image source relative to the notebook's directory
function resolveImageSource(src, currentDirPath = '') {
    if (!src) return src;
    // Preserve external URLs, data URLs, /static/ URLs, and already-resolved /api/raw/ URLs
    if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('//') || 
        src.startsWith('data:') || src.startsWith('/static/') || src.startsWith('/api/raw/')) {
        return src;
    }

    let cleanSrc = src.trim();
    let isAbsoluteFromRoot = false;
    if (cleanSrc.startsWith('/')) {
        isAbsoluteFromRoot = true;
        cleanSrc = cleanSrc.replace(/^\/+/, '');
    }

    let combinedPath = (isAbsoluteFromRoot || !currentDirPath) ? cleanSrc : `${currentDirPath}/${cleanSrc}`;

    // Normalize path (. and ..)
    const parts = combinedPath.split('/');
    const resolved = [];
    for (const part of parts) {
        if (!part || part === '.') continue;
        if (part === '..') {
            if (resolved.length > 0) {
                resolved.pop();
            }
        } else {
            resolved.push(part);
        }
    }
    const normalized = resolved.join('/');
    return `/api/raw/${encodeURI(normalized)}`;
}

// Render Markdown & LaTeX Math
function renderMarkdownWithMath(text, currentDirPath = '') {
    if (!text) return '';
    text = text.replace(/\r\n/g, '\n');

    const placeholders = [];
    let placeholderCounter = 0;

    text = text.replace(/\$\$([\s\S]+?)\$\$/g, (match, formula) => {
        const ph = `MATHBLOCKPH${placeholderCounter}`;
        placeholders.push({
            id: ph,
            formula: formula.trim(),
            displayMode: true
        });
        placeholderCounter++;
        return ph;
    });

    text = text.replace(/\$([^\$\n]+?)\$/g, (match, formula) => {
        const ph = `MATHINLINEPH${placeholderCounter}`;
        placeholders.push({
            id: ph,
            formula: formula.trim(),
            displayMode: false
        });
        placeholderCounter++;
        return ph;
    });

    text = replaceEmojiShortcodes(text);
    let html = marked.parse(text);

    placeholders.forEach(ph => {
        try {
            const mathHtml = katex.renderToString(ph.formula, {
                displayMode: ph.displayMode,
                throwOnError: false
            });
            html = html.replace(ph.id, mathHtml);
        } catch (e) {
            console.error("KaTeX render error:", e);
            html = html.replace(ph.id, `<span class="text-red-500">LaTeX Error: ${ph.formula}</span>`);
        }
    });

    // If currentDirPath is not null, rewrite relative image sources to /api/raw/...
    if (currentDirPath !== null) {
        html = html.replace(/<img\s+([^>]*?)src=["']([^"']+)["']([^>]*?)>/gi, (match, prefix, src, suffix) => {
            const newSrc = resolveImageSource(src, currentDirPath);
            return `<img ${prefix}src="${newSrc}"${suffix}>`;
        });
    }

    return html;
}

// Select Cell
function selectCell(index, shiftKey = false, paneIdx = activePaneIndex) {
    const doc = getPaneActiveDocument(paneIdx);
    if (!doc || doc.cells.length === 0) return;

    if (!shiftKey) {
        const editingIdx = doc.cells.findIndex(c => c.mode === 'edit');
        if (editingIdx !== -1 && editingIdx !== index) {
            exitEditingCell(editingIdx, doc, paneIdx);
        }
    } else {
        exitEditingCellsInDoc(doc, paneIdx);
    }

    if (index < 0) index = 0;
    if (index >= doc.cells.length) index = doc.cells.length - 1;

    if (shiftKey) {
        if (doc.selectionAnchorIndex === -1) {
            doc.selectionAnchorIndex = (doc.activeIndex !== -1) ? doc.activeIndex : index;
        }
        const start = Math.min(doc.selectionAnchorIndex, index);
        const end = Math.max(doc.selectionAnchorIndex, index);
        doc.selectedIndices = [];
        for (let i = start; i <= end; i++) {
            doc.selectedIndices.push(i);
        }
    } else {
        doc.selectionAnchorIndex = index;
        doc.selectedIndices = [index];
    }

    doc.activeIndex = index;
    updateCellHighlights(paneIdx);

    const selectedCell = document.getElementById(`cell-container-${doc.cells[index].id}`);
    if (selectedCell) {
        selectedCell.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

// Update Cell Highlights
function updateCellHighlights(paneIdx = activePaneIndex) {
    const pane = panes[paneIdx];
    const doc = getPaneActiveDocument(paneIdx);
    if (!pane || !doc) return;

    doc.cells.forEach((cell, i) => {
        const el = document.getElementById(`cell-container-${cell.id}`);
        if (!el) return;

        const isSelected = doc.selectedIndices.includes(i);
        const isActive = (i === doc.activeIndex);

        el.classList.remove(
            'border-jupyter-blue',
            'border-jupyter-active',
            'border-jupyter-cmdMode',
            'border-black',
            'border-gray-900',
            'border-transparent',
            'border-gray-400',
            'border-blue-300',
            'bg-blue-50/30',
            'bg-blue-50/50',
            'bg-slate-50',
            'bg-white',
            'shadow-md'
        );

        if (isActive) {
            if (doc.globalMode === 'edit') {
                el.classList.add('border-jupyter-blue', 'bg-white', 'shadow-md');
            } else {
                el.classList.add('border-black', 'bg-slate-50');
            }
        } else if (isSelected) {
            el.classList.add('border-blue-300', 'bg-blue-50/50');
        } else {
            el.classList.add('border-transparent');
        }

        const toolbar = el.querySelector('.cell-toolbar');
        if (toolbar) {
            if (doc.globalMode === 'command') {
                toolbar.classList.remove('hidden');
                toolbar.classList.add('flex');
            } else {
                toolbar.classList.remove('flex');
                toolbar.classList.add('hidden');
            }
        }
    });

    if (isTocOpen && paneIdx === activePaneIndex) {
        renderToc();
    }
}

// Set Doc Global Mode
function setDocGlobalMode(mode, doc = getActiveDocument()) {
    if (!doc) return;
    doc.globalMode = mode;
    if (doc === getActiveDocument()) {
        updateModeBadge();
    }
    for (let p = 0; p < openPaneCount; p++) {
        if (getPaneActiveDocument(p) === doc) {
            updateCellHighlights(p);
        }
    }
}

// Edit Cell
function editCell(index, paneIdx = activePaneIndex) {
    const doc = getPaneActiveDocument(paneIdx);
    if (!doc || index < 0 || index >= doc.cells.length) return;

    // Exit edit mode on any other cell
    const prevEditingIdx = doc.cells.findIndex(c => c.mode === 'edit');
    if (prevEditingIdx !== -1 && prevEditingIdx !== index) {
        exitEditingCell(prevEditingIdx, doc, paneIdx);
    }

    doc.cells[index].mode = 'edit';
    setDocGlobalMode('edit', doc);
    selectCell(index, false, paneIdx);
    renderCellAt(index, paneIdx);

    setTimeout(() => {
        const textarea = document.getElementById(`textarea-${doc.cells[index].id}`);
        if (textarea) {
            textarea.focus();
            const endPos = textarea.value.length;
            try {
                textarea.setSelectionRange(endPos, endPos);
            } catch (err) {}
            doc.cells[index].cursorPos = endPos;

            autoResizeTextarea(textarea, paneIdx);
            updateLineNumbers(textarea, doc.cells[index].id);
            updateCellCaretAndHighlight(textarea, doc.cells[index].id);
            updateCommentBackdrop(textarea, doc.cells[index].id);

            scrollEndLineIntoViewIfNeeded(textarea, paneIdx);
        }
    }, 50);
}

// Run (Preview) Cell
function runCell(index, paneIdx = activePaneIndex) {
    const doc = getPaneActiveDocument(paneIdx);
    if (!doc || index < 0 || index >= doc.cells.length) return;

    doc.cells[index].mode = 'view';
    renderCellAt(index, paneIdx);

    if (index === doc.cells.length - 1) {
        insertCell(index, 'below', paneIdx);
    } else {
        selectCell(index + 1, false, paneIdx);
        setDocGlobalMode('command', doc);
    }
}

// Insert Cell
function insertCell(index, direction, paneIdx = activePaneIndex) {
    const doc = getPaneActiveDocument(paneIdx);
    if (!doc) return;

    pushStateToUndoStack(doc);
    const newCell = {
        id: generateId(),
        content: '',
        mode: 'view'
    };

    let insertPos = index;
    if (direction === 'below') {
        insertPos = index + 1;
    }

    doc.cells.splice(insertPos, 0, newCell);
    renderCells(paneIdx);
    
    selectCell(insertPos, false, paneIdx);
    setDocGlobalMode('command', doc);
    markModified(true, doc);
}

// Delete Selected Cells
function deleteSelectedCells(paneIdx = activePaneIndex) {
    const doc = getPaneActiveDocument(paneIdx);
    if (!doc) return;

    pushStateToUndoStack(doc);

    if (doc.selectedIndices.length === doc.cells.length) {
        doc.cells = [{
            id: generateId(),
            content: '',
            mode: 'edit'
        }];
        renderCells(paneIdx);
        selectCell(0, false, paneIdx);
        setDocGlobalMode('edit', doc);
        markModified(true, doc);
        return;
    }

    const sortedIndices = [...doc.selectedIndices].sort((a, b) => b - a);
    sortedIndices.forEach(idx => {
        doc.cells.splice(idx, 1);
    });

    const minIndex = Math.min(...doc.selectedIndices);
    let nextSelect = minIndex;
    if (nextSelect >= doc.cells.length) {
        nextSelect = doc.cells.length - 1;
    }
    if (nextSelect < 0) nextSelect = 0;

    renderCells(paneIdx);
    selectCell(nextSelect, false, paneIdx);
    setDocGlobalMode('command', doc);
    markModified(true, doc);
}

// Delete Cell
function deleteCell(index, paneIdx = activePaneIndex) {
    const doc = getPaneActiveDocument(paneIdx);
    if (!doc) return;

    if (doc.selectedIndices.length > 1 && doc.selectedIndices.includes(index)) {
        deleteSelectedCells(paneIdx);
        return;
    }

    pushStateToUndoStack(doc);

    if (doc.cells.length <= 1) {
        doc.cells[0].content = '';
        doc.cells[0].mode = 'edit';
        renderCells(paneIdx);
        selectCell(0, false, paneIdx);
        setDocGlobalMode('edit', doc);
        markModified(true, doc);
        return;
    }

    doc.cells.splice(index, 1);
    renderCells(paneIdx);

    let nextSelect = index;
    if (nextSelect >= doc.cells.length) {
        nextSelect = doc.cells.length - 1;
    }
    selectCell(nextSelect, false, paneIdx);
    setDocGlobalMode('command', doc);
    markModified(true, doc);
}

// Move Cell
function moveCell(index, direction, paneIdx = activePaneIndex) {
    const doc = getPaneActiveDocument(paneIdx);
    if (!doc) return;

    if (direction === 'up' && index > 0) {
        pushStateToUndoStack(doc);
        const temp = doc.cells[index];
        doc.cells[index] = doc.cells[index - 1];
        doc.cells[index - 1] = temp;
        
        renderCells(paneIdx);
        selectCell(index - 1, false, paneIdx);
        markModified(true, doc);
    } else if (direction === 'down' && index < doc.cells.length - 1) {
        pushStateToUndoStack(doc);
        const temp = doc.cells[index];
        doc.cells[index] = doc.cells[index + 1];
        doc.cells[index + 1] = temp;
        
        renderCells(paneIdx);
        selectCell(index + 1, false, paneIdx);
        markModified(true, doc);
    }
}

// Copy, Cut, Paste
function copyCell(index, paneIdx = activePaneIndex) {
    const doc = getPaneActiveDocument(paneIdx);
    if (!doc || index < 0 || index >= doc.cells.length) return;
    clipboardCell = {
        content: doc.cells[index].content,
        mode: doc.cells[index].mode
    };
}

function cutCell(index, paneIdx = activePaneIndex) {
    copyCell(index, paneIdx);
    deleteCell(index, paneIdx);
}

function pasteCell(index, position = 'below', paneIdx = activePaneIndex) {
    if (!clipboardCell) return;
    const doc = getPaneActiveDocument(paneIdx);
    if (!doc) return;

    pushStateToUndoStack(doc);
    const newCell = {
        id: generateId(),
        content: clipboardCell.content,
        mode: 'view'
    };

    let pasteIndex = index;
    if (position === 'below') {
        pasteIndex = index + 1;
    }

    doc.cells.splice(pasteIndex, 0, newCell);
    renderCells(paneIdx);
    selectCell(pasteIndex, false, paneIdx);
    setDocGlobalMode('command', doc);
    markModified(true, doc);
}



function mergeSelectedCells(paneIdx = activePaneIndex) {
    const doc = getPaneActiveDocument(paneIdx);
    if (!doc || doc.selectedIndices.length <= 1) return;

    pushStateToUndoStack(doc);
    const sortedIndices = [...doc.selectedIndices].sort((a, b) => a - b);
    const firstIndex = sortedIndices[0];

    const mergedContent = sortedIndices
        .map(i => doc.cells[i].content)
        .join('\n\n');

    for (let i = sortedIndices.length - 1; i >= 1; i--) {
        doc.cells.splice(sortedIndices[i], 1);
    }

    doc.cells[firstIndex].content = mergedContent;
    renderCells(paneIdx);
    selectCell(firstIndex, false, paneIdx);
    markModified(true, doc);
}

// Helper to detect Ctrl+Alt+- across different keyboards / browsers / IME
function isMinusKeyEvent(e) {
    if (!e.ctrlKey || !e.altKey) return false;
    const key = e.key;
    const code = e.code;
    const keyCode = e.keyCode || e.which;
    return (
        key === '-' || key === 'Minus' || key === '_' || key === '–' || key === '—' ||
        code === 'Minus' || code === 'NumpadSubtract' || code === 'DigitMinus' ||
        keyCode === 189 || keyCode === 109 || keyCode === 173
    );
}

// Convert character index to line index inside textarea
function getSelectedLineRange(textarea) {
    const text = textarea.value;
    const startPos = textarea.selectionStart;
    const endPos = textarea.selectionEnd;

    const lines = text.split('\n');
    let charCount = 0;
    let startLineIdx = -1;
    let endLineIdx = -1;

    for (let i = 0; i < lines.length; i++) {
        const lineLength = lines[i].length + 1; // +1 for the newline character

        if (startLineIdx === -1 && charCount + lineLength > startPos) {
            startLineIdx = i;
        }
        if (endLineIdx === -1 && charCount + lineLength >= endPos) {
            endLineIdx = i;
        }

        charCount += lineLength;
    }

    if (startLineIdx === -1) startLineIdx = lines.length - 1;
    if (endLineIdx === -1) endLineIdx = lines.length - 1;

    return {
        lines,
        startLineIdx,
        endLineIdx
    };
}

// Split Cell in Edit Mode based on selected text range
function splitCell(index, paneIdx = activePaneIndex) {
    const doc = getPaneActiveDocument(paneIdx);
    if (!doc || index < 0 || index >= doc.cells.length) return;

    const cell = doc.cells[index];
    const textarea = document.getElementById(`textarea-${cell.id}`);
    if (!textarea) return;

    const range = getSelectedLineRange(textarea);
    if (!range) return;

    const lines = range.lines;
    const startLineIdx = range.startLineIdx;
    const endLineIdx = range.endLineIdx;

    // Cannot split if cell has only one line or no split criteria met
    if (lines.length <= 1) return;

    const totalLines = lines.length;
    let newCells = [];
    let activeCellRelativeIndex = 0;

    // Case A-1: Split into 2 cells (Select from start line to some middle line)
    // Selected portion is the first cell (cell1)
    if (startLineIdx === 0 && endLineIdx < totalLines - 1) {
        const part1Text = lines.slice(0, endLineIdx + 1).join('\n');
        const part2Text = lines.slice(endLineIdx + 1).join('\n');

        const cell1 = { id: generateId(), content: part1Text, mode: 'view' };
        const cell2 = { id: generateId(), content: part2Text, mode: 'view' };

        newCells = [cell1, cell2];
        activeCellRelativeIndex = 0; // Newly generated cell from selected lines
    }
    // Case A-2: Split into 2 cells (Select from some middle line to the end line)
    // Selected portion is the second cell (cell2)
    else if (startLineIdx > 0 && endLineIdx === totalLines - 1) {
        const part1Text = lines.slice(0, startLineIdx).join('\n');
        const part2Text = lines.slice(startLineIdx).join('\n');

        const cell1 = { id: generateId(), content: part1Text, mode: 'view' };
        const cell2 = { id: generateId(), content: part2Text, mode: 'view' };

        newCells = [cell1, cell2];
        activeCellRelativeIndex = 1; // Newly generated cell from selected lines
    }
    // Case B: Split into 3 cells (Select middle part of the cell, start and end lines not included)
    // Selected portion is the middle cell (cell2)
    else if (startLineIdx > 0 && endLineIdx < totalLines - 1) {
        const part1Text = lines.slice(0, startLineIdx).join('\n');
        const part2Text = lines.slice(startLineIdx, endLineIdx + 1).join('\n');
        const part3Text = lines.slice(endLineIdx + 1).join('\n');

        const cell1 = { id: generateId(), content: part1Text, mode: 'view' };
        const cell2 = { id: generateId(), content: part2Text, mode: 'view' };
        const cell3 = { id: generateId(), content: part3Text, mode: 'view' };

        newCells = [cell1, cell2, cell3];
        activeCellRelativeIndex = 1; // Newly generated cell from selected lines
    }
    // If selecting everything (0 to totalLines - 1) or other invalid range, ignore
    else {
        return;
    }

    // Calculate start character position of the selected line (startLineIdx)
    let selectedLineStartPos = 0;
    for (let i = 0; i < startLineIdx; i++) {
        selectedLineStartPos += lines[i].length + 1;
    }

    // Sync textarea before pushing to undo stack
    cell.content = textarea.value;

    // Record state for Undo with cursor position and recenter flag
    pushStateToUndoStack(doc, {
        cursorPos: selectedLineStartPos,
        recenterLine: true
    });

    // Invalidate old cell mode so any pending blur timeout does not overwrite selection
    cell.mode = 'view';

    doc.cells.splice(index, 1, ...newCells);
    renderCells(paneIdx);

    const targetIdx = index + activeCellRelativeIndex;
    selectCell(targetIdx, false, paneIdx);
    setDocGlobalMode('command', doc);
    markModified(true, doc);
}

// Get standard line height in command mode
function getCommandModeLineHeight(cellEl) {
    if (cellEl) {
        const preview = cellEl.querySelector('.markdown-preview') || cellEl;
        const comp = window.getComputedStyle(preview);
        const lh = parseFloat(comp.lineHeight);
        if (!isNaN(lh) && lh > 0) return lh;
        const fs = parseFloat(comp.fontSize);
        if (!isNaN(fs) && fs > 0) return fs * 1.5;
    }
    return 24;
}

// Reusable mirror element for accurate caret & highlight coordinate calculation
let reusableCaretMirror = null;
function getReusableCaretMirror() {
    if (!reusableCaretMirror) {
        reusableCaretMirror = document.createElement('div');
        reusableCaretMirror.id = 'reusable-caret-mirror';
        reusableCaretMirror.style.position = 'absolute';
        reusableCaretMirror.style.visibility = 'hidden';
        reusableCaretMirror.style.pointerEvents = 'none';
        reusableCaretMirror.style.top = '0';
        reusableCaretMirror.style.left = '-9999px';
        reusableCaretMirror.style.whiteSpace = 'pre-wrap';
        reusableCaretMirror.style.wordWrap = 'break-word';
        reusableCaretMirror.style.overflowWrap = 'break-word';
        document.body.appendChild(reusableCaretMirror);
    }
    return reusableCaretMirror;
}

// Get caret line coordinates (X, Y offset, char width, line height) inside textarea via mirror element
function getCaretLineInfo(textarea, customPos = null) {
    if (!textarea) return { caretOffsetX: 0, caretOffsetY: 0, charWidth: 8.4, lineHeight: 20 };
    const comp = window.getComputedStyle(textarea);
    let lh = parseFloat(comp.lineHeight);

    const text = textarea.value || '';
    const pos = (customPos !== null && customPos !== undefined) ? customPos : (textarea.selectionStart || 0);
    const textBefore = text.substring(0, pos);
    const charAtCursor = text.charAt(pos);

    const mirror = getReusableCaretMirror();
    mirror.style.boxSizing = comp.boxSizing;
    mirror.style.width = (comp.boxSizing === 'border-box' ? textarea.offsetWidth : textarea.clientWidth) + 'px';
    mirror.style.fontFamily = comp.fontFamily;
    mirror.style.fontSize = comp.fontSize;
    mirror.style.fontWeight = comp.fontWeight;
    mirror.style.lineHeight = comp.lineHeight;
    mirror.style.letterSpacing = comp.letterSpacing;
    mirror.style.padding = comp.padding;
    mirror.style.border = comp.border;

    mirror.innerHTML = '';
    const textNode = document.createTextNode(textBefore);
    const marker = document.createElement('span');
    marker.textContent = (charAtCursor === '\n' || !charAtCursor) ? ' ' : charAtCursor;

    mirror.appendChild(textNode);
    mirror.appendChild(marker);

    const mirrorRect = mirror.getBoundingClientRect();
    const markerRect = marker.getBoundingClientRect();
    const caretOffsetX = markerRect.left - mirrorRect.left;
    const caretOffsetY = markerRect.top - mirrorRect.top;

    if (isNaN(lh) || lh <= 0) {
        lh = markerRect.height || 20;
    }

    const charWidth = markerRect.width || 8.4;

    return {
        caretOffsetX,
        caretOffsetY,
        charWidth,
        lineHeight: lh
    };
}

// Update line numbers gutter in edit mode
function updateLineNumbers(textarea, cellId) {
    if (!textarea) return;
    const cid = cellId || (textarea.id ? textarea.id.replace('textarea-', '') : null);
    if (!cid) return;
    const gutter = document.getElementById(`line-numbers-${cid}`);
    if (!gutter) return;

    const text = textarea.value || '';
    const lines = text.split('\n');
    const comp = window.getComputedStyle(textarea);
    let baseLh = parseFloat(comp.lineHeight);
    if (isNaN(baseLh) || baseLh <= 0) baseLh = 20;

    const textareaWidth = comp.boxSizing === 'border-box' ? textarea.offsetWidth : textarea.clientWidth;
    const padLeft = parseFloat(comp.paddingLeft) || 8;
    const padRight = parseFloat(comp.paddingRight) || 8;
    const innerWidth = Math.max(10, textareaWidth - padLeft - padRight);

    const mirror = getReusableCaretMirror();
    mirror.style.boxSizing = 'border-box';
    mirror.style.width = innerWidth + 'px';
    mirror.style.fontFamily = comp.fontFamily;
    mirror.style.fontSize = comp.fontSize;
    mirror.style.fontWeight = comp.fontWeight;
    mirror.style.lineHeight = comp.lineHeight;
    mirror.style.letterSpacing = comp.letterSpacing;
    mirror.style.padding = '0px';
    mirror.style.border = '0px';
    mirror.style.wordBreak = 'break-word';
    mirror.style.whiteSpace = 'pre-wrap';

    mirror.innerHTML = '';
    const lineDivs = [];
    for (let i = 0; i < lines.length; i++) {
        const d = document.createElement('div');
        d.textContent = lines[i] === '' ? ' ' : lines[i];
        d.style.margin = '0';
        d.style.padding = '0';
        d.style.lineHeight = comp.lineHeight;
        mirror.appendChild(d);
        lineDivs.push(d);
    }

    let gutterHtml = '';
    for (let i = 0; i < lines.length; i++) {
        const lineH = lineDivs[i] ? (lineDivs[i].offsetHeight || baseLh) : baseLh;
        gutterHtml += `<div class="cell-line-number-row" style="height: ${lineH}px; line-height: ${baseLh}px;">${i + 1}</div>`;
    }
    gutter.innerHTML = gutterHtml;
}

// Update block cursor and current line highlight in edit mode
function updateCellCaretAndHighlight(textarea, cellId) {
    if (!textarea) return;
    const cid = cellId || (textarea.id ? textarea.id.replace('textarea-', '') : null);
    if (!cid) return;

    const highlightEl = document.getElementById(`line-highlight-${cid}`);
    const cursorEl = document.getElementById(`block-cursor-${cid}`);
    if (!highlightEl && !cursorEl) return;

    if (document.activeElement !== textarea) {
        if (highlightEl) highlightEl.classList.add('hidden');
        if (cursorEl) cursorEl.classList.add('hidden');
        return;
    }

    // Hide custom block cursor and line highlight if a text range is selected
    if (textarea.selectionStart !== textarea.selectionEnd) {
        if (highlightEl) highlightEl.classList.add('hidden');
        if (cursorEl) cursorEl.classList.add('hidden');
        return;
    }

    const info = getCaretLineInfo(textarea);
    if (!info) return;

    const { caretOffsetX, caretOffsetY, charWidth, lineHeight } = info;

    if (highlightEl) {
        highlightEl.classList.remove('hidden');
        highlightEl.style.top = caretOffsetY + 'px';
        highlightEl.style.height = lineHeight + 'px';
    }

    if (cursorEl) {
        cursorEl.classList.remove('hidden');
        cursorEl.style.left = caretOffsetX + 'px';
        cursorEl.style.top = caretOffsetY + 'px';
        cursorEl.style.width = Math.max(charWidth, 8) + 'px';
        cursorEl.style.height = lineHeight + 'px';

        // Reset blink phase so it stays solidly visible while moving/typing
        cursorEl.style.animation = 'none';
        void cursorEl.offsetHeight; // trigger reflow
        cursorEl.style.animation = 'block-cursor-blink 1s step-end infinite';
    }
}

// Edit Mode: Position current caret line 12 lines below pane-header bottom line
function recenterCaretLine(activeEl, paneIdx = activePaneIndex) {
    if (!activeEl) return;
    const pane = panes[paneIdx];
    const scrollContainer = pane ? pane.cellsScrollEl : notebookContainer;
    if (!scrollContainer) return;

    const paneHeader = pane && pane.containerEl ? pane.containerEl.querySelector('.pane-header') : null;
    const headerBottom = paneHeader ? paneHeader.getBoundingClientRect().bottom : scrollContainer.getBoundingClientRect().top;

    const { caretOffsetY, lineHeight } = getCaretLineInfo(activeEl);
    const textareaRect = activeEl.getBoundingClientRect();
    const caretLineTop = textareaRect.top + caretOffsetY - (activeEl.scrollTop || 0);

    const targetDistance = 12 * lineHeight;
    const diff = (caretLineTop - headerBottom) - targetDistance;
    const targetScrollTop = scrollContainer.scrollTop + diff;

    scrollContainer.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: 'smooth'
    });
}

// Command Mode: Position active cell top border 2 lines below pane-header bottom line
function recenterActiveCellTop(paneIdx = activePaneIndex) {
    const doc = getPaneActiveDocument(paneIdx);
    if (!doc || doc.activeIndex === -1 || doc.cells.length === 0) return;

    const cellEl = document.getElementById(`cell-container-${doc.cells[doc.activeIndex].id}`);
    const pane = panes[paneIdx];
    const scrollContainer = pane ? pane.cellsScrollEl : notebookContainer;
    if (!cellEl || !scrollContainer) return;

    const paneHeader = pane && pane.containerEl ? pane.containerEl.querySelector('.pane-header') : null;
    const headerBottom = paneHeader ? paneHeader.getBoundingClientRect().bottom : scrollContainer.getBoundingClientRect().top;

    const cellRect = cellEl.getBoundingClientRect();
    const lh = getCommandModeLineHeight(cellEl);
    const targetDistance = 2 * lh;

    const diff = (cellRect.top - headerBottom) - targetDistance;
    const targetScrollTop = scrollContainer.scrollTop + diff;

    scrollContainer.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: 'smooth'
    });
}

// Scroll so that the top of the cell / first line is within view if it overflows above the viewport
function scrollStartLineIntoViewIfNeeded(textarea, paneIdx = activePaneIndex) {
    if (!textarea) return;
    const pane = panes[paneIdx];
    const scrollContainer = pane ? pane.cellsScrollEl : notebookContainer;
    if (!scrollContainer) return;

    const paneHeader = pane && pane.containerEl ? pane.containerEl.querySelector('.pane-header') : null;
    const headerBottom = paneHeader ? paneHeader.getBoundingClientRect().bottom : scrollContainer.getBoundingClientRect().top;

    const topMargin = 12;
    const visibleTop = headerBottom + topMargin;

    const textareaRect = textarea.getBoundingClientRect();

    if (textareaRect.top < visibleTop) {
        const diff = textareaRect.top - visibleTop;
        scrollContainer.scrollTo({
            top: Math.max(0, scrollContainer.scrollTop + diff),
            behavior: 'smooth'
        });
    }
}

// Scroll so that the bottom of the cell / last line is within view if it overflows below the viewport
function scrollEndLineIntoViewIfNeeded(textarea, paneIdx = activePaneIndex) {
    if (!textarea) return;
    const pane = panes[paneIdx];
    const scrollContainer = pane ? pane.cellsScrollEl : notebookContainer;
    if (!scrollContainer) return;

    const textareaRect = textarea.getBoundingClientRect();
    const scrollContainerRect = scrollContainer.getBoundingClientRect();

    const bottomMargin = 20;
    const visibleBottom = scrollContainerRect.bottom - bottomMargin;

    if (textareaRect.bottom > visibleBottom) {
        const overflow = textareaRect.bottom - visibleBottom;
        scrollContainer.scrollTo({
            top: scrollContainer.scrollTop + overflow,
            behavior: 'smooth'
        });
    }
}

// Scroll so that a specific search match is within view in the scroll container
function scrollMatchIntoView(textarea, matchPos, paneIdx = activePaneIndex) {
    if (!textarea) return;
    const pane = panes[paneIdx];
    const scrollContainer = pane ? pane.cellsScrollEl : notebookContainer;
    if (!scrollContainer) return;

    const paneHeader = pane && pane.containerEl ? pane.containerEl.querySelector('.pane-header') : null;
    const promptBar = pane && pane.promptBarEl ? pane.promptBarEl : null;
    const topElement = (promptBar && !promptBar.classList.contains('hidden')) ? promptBar : paneHeader;
    const topBoundary = topElement ? topElement.getBoundingClientRect().bottom : scrollContainer.getBoundingClientRect().top;
    const bottomBoundary = scrollContainer.getBoundingClientRect().bottom - 24;

    const { caretOffsetY, lineHeight } = getCaretLineInfo(textarea, matchPos);
    const textareaRect = textarea.getBoundingClientRect();
    const matchLineTop = textareaRect.top + caretOffsetY - (textarea.scrollTop || 0);
    const matchLineBottom = matchLineTop + lineHeight;

    if (matchLineTop < topBoundary + 10) {
        const diff = matchLineTop - (topBoundary + 16);
        scrollContainer.scrollTo({
            top: Math.max(0, scrollContainer.scrollTop + diff),
            behavior: 'smooth'
        });
    } else if (matchLineBottom > bottomBoundary) {
        const diff = matchLineBottom - bottomBoundary;
        scrollContainer.scrollTo({
            top: scrollContainer.scrollTop + diff,
            behavior: 'smooth'
        });
    }
}

// Pane Prompt Bar & In-Cell String Replacement System
let activePromptState = null;

function openReplacePrompt(paneIdx = activePaneIndex) {
    const doc = getPaneActiveDocument(paneIdx);
    if (!doc || doc.activeIndex === -1 || doc.cells.length === 0) return;
    const cell = doc.cells[doc.activeIndex];
    if (cell.mode !== 'edit') return;

    const textarea = document.getElementById(`textarea-${cell.id}`);
    if (!textarea) return;

    // Get selected text if any
    let selectedText = '';
    if (textarea.selectionStart !== textarea.selectionEnd) {
        selectedText = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd);
    }

    activePromptState = {
        type: 'replace',
        paneIdx,
        cellId: cell.id,
        cellIndex: doc.activeIndex,
        step: 'input',
        oldText: selectedText,
        newText: '',
        currentMatchIdx: 0
    };

    const promptBar = panes[paneIdx].promptBarEl;
    if (!promptBar) return;

    promptBar.innerHTML = `
        <div class="flex items-center space-x-2 flex-1 min-w-0">
            <span class="font-bold text-gray-700 flex-shrink-0 text-xs">Replace:</span>
            <input type="text" id="prompt-input-old-${paneIdx}" class="prompt-input w-36 sm:w-48" placeholder="Search string..." value="${escapeHtml(selectedText)}">
            <span class="text-gray-400 font-bold flex-shrink-0">→</span>
            <input type="text" id="prompt-input-new-${paneIdx}" class="prompt-input w-36 sm:w-48" placeholder="Replacement...">
        </div>
        <div id="prompt-guide-${paneIdx}" class="prompt-guide-container flex items-center space-x-2 flex-shrink-0 text-gray-500">
        </div>
    `;

    promptBar.classList.remove('hidden');

    const oldInput = document.getElementById(`prompt-input-old-${paneIdx}`);
    const newInput = document.getElementById(`prompt-input-new-${paneIdx}`);

    const handleOldInputEvents = () => {
        activePromptState.oldText = oldInput.value;
        updateReplacePromptGuide(paneIdx);
    };

    const handleNewInputEvents = () => {
        activePromptState.newText = newInput.value;
        updateReplacePromptGuide(paneIdx);
    };

    oldInput.addEventListener('input', handleOldInputEvents);
    newInput.addEventListener('input', handleNewInputEvents);

    oldInput.addEventListener('focus', () => updateReplacePromptGuide(paneIdx));
    newInput.addEventListener('focus', () => updateReplacePromptGuide(paneIdx));
    oldInput.addEventListener('blur', () => setTimeout(() => updateReplacePromptGuide(paneIdx), 30));
    newInput.addEventListener('blur', () => setTimeout(() => updateReplacePromptGuide(paneIdx), 30));

    oldInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            newInput.focus();
            newInput.select();
        } else if (e.key === 'ArrowRight' && oldInput.selectionStart === oldInput.value.length) {
            e.preventDefault();
            newInput.focus();
            newInput.setSelectionRange(0, 0);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            closePromptBar(paneIdx);
        }
    });

    newInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const matches = findExactMatches(textarea.value, activePromptState.oldText);
            if (matches.length > 0) {
                startReplaceConfirmation(paneIdx);
            }
        } else if (e.key === 'ArrowLeft' && newInput.selectionStart === 0) {
            e.preventDefault();
            oldInput.focus();
            const len = oldInput.value.length;
            oldInput.setSelectionRange(len, len);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            closePromptBar(paneIdx);
        }
    });

    updateReplacePromptGuide(paneIdx);

    if (selectedText) {
        newInput.focus();
    } else {
        oldInput.focus();
    }
}

function updateReplacePromptGuide(paneIdx) {
    if (!activePromptState || activePromptState.step !== 'input') return;
    const guideEl = document.getElementById(`prompt-guide-${paneIdx}`);
    if (!guideEl) return;

    const textarea = document.getElementById(`textarea-${activePromptState.cellId}`);
    const matches = findExactMatches(textarea ? textarea.value : '', activePromptState.oldText);

    if (textarea) {
        updateCommentBackdrop(textarea, activePromptState.cellId);
    }

    if (!activePromptState.oldText) {
        guideEl.innerHTML = '<span class="text-gray-400 text-xs">Esc to cancel</span>';
        return;
    }

    if (matches.length === 0) {
        guideEl.innerHTML = '<span class="text-rose-500 font-medium text-xs">No matches</span> <span class="text-gray-300 ml-1">|</span> <span class="text-gray-400 text-[11px] ml-1">Esc</span>';
        return;
    }

    const newInput = document.getElementById(`prompt-input-new-${paneIdx}`);
    const isNewInputFocused = (document.activeElement === newInput);

    if (isNewInputFocused) {
        guideEl.innerHTML = `
            <span class="text-gray-600 font-medium mr-1 text-xs">${matches.length} match${matches.length > 1 ? 'es' : ''}</span>
            <span class="prompt-enter-badge"><i class="fa-solid fa-arrow-turn-down fa-rotate-90 mr-1 text-[10px]"></i>Press Enter</span>
            <span class="text-gray-300 ml-1">|</span>
            <span class="text-gray-400 text-[11px] ml-1">Esc</span>
        `;
    } else {
        guideEl.innerHTML = `
            <span class="text-gray-500 font-medium mr-1 text-xs">${matches.length} match${matches.length > 1 ? 'es' : ''}</span>
            <span class="text-gray-400 text-[11px]">Enter/Tab to next</span>
        `;
    }
}

function startReplaceConfirmation(paneIdx) {
    if (!activePromptState) return;
    activePromptState.step = 'confirm';
    activePromptState.currentMatchIdx = 0;

    const textarea = document.getElementById(`textarea-${activePromptState.cellId}`);
    if (!textarea) return;

    const matches = findExactMatches(textarea.value, activePromptState.oldText);
    if (matches.length === 0) {
        closePromptBar(paneIdx);
        return;
    }

    renderConfirmationPrompt(paneIdx);
    updateCommentBackdrop(textarea, activePromptState.cellId);
    scrollMatchIntoView(textarea, matches[0].start, paneIdx);
}

function renderConfirmationPrompt(paneIdx) {
    if (!activePromptState) return;
    const promptBar = panes[paneIdx].promptBarEl;
    if (!promptBar) return;

    const textarea = document.getElementById(`textarea-${activePromptState.cellId}`);
    const matches = findExactMatches(textarea ? textarea.value : '', activePromptState.oldText);
    const total = matches.length;
    const current = Math.min(activePromptState.currentMatchIdx + 1, total);

    promptBar.innerHTML = `
        <div class="flex items-center space-x-3 flex-1 min-w-0 font-medium text-xs">
            <span class="text-gray-800">Replace match <strong class="text-jupyter-blue">${current}</strong> of <strong>${total}</strong>?</span>
            <span class="text-gray-400 text-xs truncate max-w-xs">"${escapeHtml(activePromptState.oldText)}" → "${escapeHtml(activePromptState.newText)}"</span>
        </div>
        <div class="flex items-center space-x-2 flex-shrink-0 select-none text-xs">
            <span class="prompt-key-badge text-jupyter-blue">y</span><span class="text-gray-600 mr-2 text-[11px]">yes</span>
            <span class="prompt-key-badge text-gray-700">n</span><span class="text-gray-600 mr-2 text-[11px]">no</span>
            <span class="prompt-key-badge text-purple-600">a</span><span class="text-gray-600 mr-2 text-[11px]">all</span>
            <span class="prompt-key-badge text-rose-600">q</span><span class="text-gray-600 text-[11px]">quit</span>
        </div>
    `;
}

function handleReplaceConfirmKey(e, paneIdx) {
    if (!activePromptState || activePromptState.step !== 'confirm') return false;

    const key = e.key.toLowerCase();
    if (key !== 'y' && key !== 'n' && key !== 'a' && key !== 'q' && e.key !== 'Escape') {
        return false;
    }

    e.preventDefault();
    e.stopPropagation();

    const textarea = document.getElementById(`textarea-${activePromptState.cellId}`);
    const doc = getPaneActiveDocument(paneIdx);
    if (!textarea || !doc) {
        closePromptBar(paneIdx);
        return true;
    }

    if (key === 'y') {
        // Replace current match
        pushStateToUndoStack(doc);
        const matches = findExactMatches(textarea.value, activePromptState.oldText);
        if (activePromptState.currentMatchIdx < matches.length) {
            const m = matches[activePromptState.currentMatchIdx];
            const newVal = textarea.value.substring(0, m.start) + activePromptState.newText + textarea.value.substring(m.end);
            textarea.value = newVal;
            doc.cells[activePromptState.cellIndex].content = newVal;
            markModified(true, doc);
            autoResizeTextarea(textarea, paneIdx);
            updateLineNumbers(textarea, activePromptState.cellId);

            // Check remaining matches
            const remainingMatches = findExactMatches(textarea.value, activePromptState.oldText);
            if (activePromptState.currentMatchIdx < remainingMatches.length) {
                renderConfirmationPrompt(paneIdx);
                updateCommentBackdrop(textarea, activePromptState.cellId);
                scrollMatchIntoView(textarea, remainingMatches[activePromptState.currentMatchIdx].start, paneIdx);
            } else {
                closePromptBar(paneIdx);
            }
        } else {
            closePromptBar(paneIdx);
        }
    } else if (key === 'n') {
        // Skip current match
        activePromptState.currentMatchIdx++;
        const matches = findExactMatches(textarea.value, activePromptState.oldText);
        if (activePromptState.currentMatchIdx < matches.length) {
            renderConfirmationPrompt(paneIdx);
            updateCommentBackdrop(textarea, activePromptState.cellId);
            scrollMatchIntoView(textarea, matches[activePromptState.currentMatchIdx].start, paneIdx);
        } else {
            closePromptBar(paneIdx);
        }
    } else if (key === 'a') {
        // Replace all remaining matches
        pushStateToUndoStack(doc);
        const matches = findExactMatches(textarea.value, activePromptState.oldText);
        if (activePromptState.currentMatchIdx < matches.length) {
            const splitIdx = matches[activePromptState.currentMatchIdx].start;
            const before = textarea.value.substring(0, splitIdx);
            const after = textarea.value.substring(splitIdx).split(activePromptState.oldText).join(activePromptState.newText);
            const newVal = before + after;
            textarea.value = newVal;
            doc.cells[activePromptState.cellIndex].content = newVal;
            markModified(true, doc);
            autoResizeTextarea(textarea, paneIdx);
            updateLineNumbers(textarea, activePromptState.cellId);
        }
        closePromptBar(paneIdx);
    } else if (key === 'q' || e.key === 'Escape') {
        closePromptBar(paneIdx);
    }

    return true;
}

function closePromptBar(paneIdx = activePaneIndex) {
    if (panes[paneIdx] && panes[paneIdx].promptBarEl) {
        panes[paneIdx].promptBarEl.classList.add('hidden');
        panes[paneIdx].promptBarEl.innerHTML = '';
    }
    if (activePromptState) {
        const cellId = activePromptState.cellId;
        activePromptState = null;
        const textarea = document.getElementById(`textarea-${cellId}`);
        if (textarea) {
            updateCommentBackdrop(textarea, cellId);
            textarea.focus();
        }
    }
}

function openGoToLinePrompt(paneIdx = activePaneIndex) {
    const doc = getPaneActiveDocument(paneIdx);
    if (!doc || doc.activeIndex === -1 || doc.cells.length === 0) return;
    const cell = doc.cells[doc.activeIndex];
    if (cell.mode !== 'edit') return;

    const textarea = document.getElementById(`textarea-${cell.id}`);
    if (!textarea) return;

    const lines = textarea.value.split('\n');
    const totalLines = lines.length;

    activePromptState = {
        type: 'goto',
        paneIdx,
        cellId: cell.id,
        cellIndex: doc.activeIndex,
        totalLines: totalLines
    };

    const promptBar = panes[paneIdx].promptBarEl;
    if (!promptBar) return;

    promptBar.innerHTML = `
        <div class="flex items-center space-x-2 flex-1 min-w-0">
            <span class="font-bold text-gray-700 flex-shrink-0 text-xs">Go to Line:</span>
            <input type="text" id="prompt-input-goto-${paneIdx}" class="prompt-input w-28 sm:w-36" placeholder="1-${totalLines}">
        </div>
        <div id="prompt-guide-${paneIdx}" class="prompt-guide-container flex items-center space-x-2 flex-shrink-0 text-gray-500">
        </div>
    `;

    promptBar.classList.remove('hidden');

    const gotoInput = document.getElementById(`prompt-input-goto-${paneIdx}`);
    if (!gotoInput) return;

    gotoInput.addEventListener('input', () => updateGoToLinePromptGuide(paneIdx));
    gotoInput.addEventListener('focus', () => updateGoToLinePromptGuide(paneIdx));
    gotoInput.addEventListener('blur', () => setTimeout(() => updateGoToLinePromptGuide(paneIdx), 30));

    gotoInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const val = gotoInput.value.trim();
            if (/^\d+$/.test(val)) {
                const num = parseInt(val, 10);
                if (num >= 1 && num <= activePromptState.totalLines) {
                    executeGoToLine(paneIdx);
                } else {
                    closePromptBar(paneIdx);
                }
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            closePromptBar(paneIdx);
        }
    });

    updateGoToLinePromptGuide(paneIdx);
    gotoInput.focus();
}

function updateGoToLinePromptGuide(paneIdx) {
    if (!activePromptState || activePromptState.type !== 'goto') return;
    const guideEl = document.getElementById(`prompt-guide-${paneIdx}`);
    if (!guideEl) return;

    const gotoInput = document.getElementById(`prompt-input-goto-${paneIdx}`);
    const val = gotoInput ? gotoInput.value.trim() : '';

    if (!val) {
        guideEl.innerHTML = `
            <span class="text-gray-400 text-xs">Line 1-${activePromptState.totalLines}</span>
            <span class="text-gray-300 ml-1">|</span>
            <span class="text-gray-400 text-[11px] ml-1">Esc to cancel</span>
        `;
        return;
    }

    const isValidFormat = /^\d+$/.test(val);
    const num = isValidFormat ? parseInt(val, 10) : NaN;
    const isInRange = isValidFormat && !isNaN(num) && num >= 1 && num <= activePromptState.totalLines;

    if (isInRange) {
        guideEl.innerHTML = `
            <button type="button" id="prompt-btn-goto-${paneIdx}" class="prompt-enter-badge cursor-pointer hover:bg-blue-600 hover:text-white transition-colors duration-150">
                <i class="fa-solid fa-arrow-turn-down fa-rotate-90 mr-1 text-[10px]"></i>Press Enter
            </button>
            <span class="text-gray-300 ml-1">|</span>
            <span class="text-gray-400 text-[11px] ml-1">Esc</span>
        `;
        const btn = document.getElementById(`prompt-btn-goto-${paneIdx}`);
        if (btn) {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                executeGoToLine(paneIdx);
            });
        }
    } else {
        guideEl.innerHTML = `
            <span class="text-rose-500 font-medium text-xs">Invalid line (1-${activePromptState.totalLines})</span>
            <span class="text-gray-300 ml-1">|</span>
            <span class="text-gray-400 text-[11px] ml-1">Esc to cancel</span>
        `;
    }
}

function executeGoToLine(paneIdx = activePaneIndex) {
    if (!activePromptState || activePromptState.type !== 'goto') return;
    const gotoInput = document.getElementById(`prompt-input-goto-${paneIdx}`);
    if (!gotoInput) return;

    const val = gotoInput.value.trim();
    const cellId = activePromptState.cellId;
    const totalLines = activePromptState.totalLines;
    const textarea = document.getElementById(`textarea-${cellId}`);

    if (!/^\d+$/.test(val)) return;

    const targetLine = parseInt(val, 10);
    if (targetLine < 1 || targetLine > totalLines) {
        closePromptBar(paneIdx);
        return;
    }

    if (textarea) {
        const lines = textarea.value.split('\n');
        let charIndex = 0;
        for (let i = 0; i < targetLine - 1; i++) {
            charIndex += lines[i].length + 1; // +1 for '\n'
        }

        closePromptBar(paneIdx);

        textarea.setSelectionRange(charIndex, charIndex);
        updateCellCaretAndHighlight(textarea, cellId);

        setTimeout(() => {
            recenterCaretLine(textarea, paneIdx);
        }, 50);
    } else {
        closePromptBar(paneIdx);
    }
}

function selectAllCells(paneIdx = activePaneIndex) {
    const doc = getPaneActiveDocument(paneIdx);
    if (!doc || doc.cells.length === 0) return;

    doc.selectedIndices = doc.cells.map((_, i) => i);
    doc.selectionAnchorIndex = 0;
    updateCellHighlights(paneIdx);
}

function clearSelection(paneIdx = activePaneIndex) {
    const doc = getPaneActiveDocument(paneIdx);
    if (!doc) return;

    const anchorIdx = (doc.selectionAnchorIndex !== -1 && doc.selectionAnchorIndex < doc.cells.length)
        ? doc.selectionAnchorIndex
        : doc.activeIndex;

    if (anchorIdx !== -1) {
        selectCell(anchorIdx, false, paneIdx);
    } else {
        doc.selectedIndices = [];
        doc.selectionAnchorIndex = -1;
        updateCellHighlights(paneIdx);
    }
}

// Undo & Redo System
function serializeDocState(doc, extraData = {}) {
    doc.cells.forEach(cell => {
        if (cell.mode === 'edit') {
            const textarea = document.getElementById(`textarea-${cell.id}`);
            if (textarea) cell.content = textarea.value;
        }
    });
    return {
        cells: doc.cells.map(c => ({ id: c.id, content: c.content, mode: c.mode })),
        activeIndex: doc.activeIndex,
        selectedIndices: [...doc.selectedIndices],
        globalMode: doc.globalMode,
        cursorPos: extraData.cursorPos !== undefined ? extraData.cursorPos : null,
        recenterLine: extraData.recenterLine || false
    };
}

function pushStateToUndoStack(doc, extraData = {}) {
    if (!doc) return;
    doc.undoStack.push(serializeDocState(doc, extraData));
    if (doc.undoStack.length > MAX_STACK_SIZE) {
        doc.undoStack.shift();
    }
    doc.redoStack = [];
}

function undoCellOperation(paneIdx = activePaneIndex) {
    const doc = getPaneActiveDocument(paneIdx);
    if (!doc || doc.undoStack.length === 0) return;

    doc.redoStack.push(serializeDocState(doc));
    const previousState = doc.undoStack.pop();
    applyDocState(doc, previousState, paneIdx);
    markModified(true, doc);
}

function redoCellOperation(paneIdx = activePaneIndex) {
    const doc = getPaneActiveDocument(paneIdx);
    if (!doc || doc.redoStack.length === 0) return;

    doc.undoStack.push(serializeDocState(doc));
    const nextState = doc.redoStack.pop();
    applyDocState(doc, nextState, paneIdx);
    markModified(true, doc);
}

function applyDocState(doc, state, paneIdx) {
    doc.cells = state.cells.map(c => ({ id: c.id, content: c.content, mode: c.mode }));
    doc.activeIndex = state.activeIndex;
    doc.selectedIndices = [...state.selectedIndices];
    doc.globalMode = state.globalMode;

    renderCells(paneIdx);
    updateCellHighlights(paneIdx);
    setDocGlobalMode(doc.globalMode, doc);

    if (state.globalMode === 'edit' && doc.activeIndex >= 0 && doc.activeIndex < doc.cells.length && doc.cells[doc.activeIndex].mode === 'edit') {
        setTimeout(() => {
            const activeCell = doc.cells[doc.activeIndex];
            const textarea = document.getElementById(`textarea-${activeCell.id}`);
            if (textarea) {
                textarea.focus();
                autoResizeTextarea(textarea, paneIdx);
                if (state.cursorPos !== null && state.cursorPos !== undefined) {
                    const pos = Math.min(Math.max(0, state.cursorPos), textarea.value.length);
                    textarea.setSelectionRange(pos, pos);
                }
                if (state.recenterLine) {
                    setTimeout(() => {
                        recenterCaretLine(textarea, paneIdx);
                    }, 50);
                }
            }
        }, 50);
    }
}

// Browser Item Selection
function selectBrowserItem(name, isFolder, relPath, el) {
    if (selectedBrowserItem && selectedBrowserItem.el && selectedBrowserItem.el !== el) {
        selectedBrowserItem.el.classList.remove('bg-blue-100', 'text-jupyter-blue', 'font-semibold');
    }
    selectedBrowserItem = { name, isFolder, relPath, el };
    if (el) {
        el.classList.add('bg-blue-100', 'text-jupyter-blue', 'font-semibold');
    }
}

function clearBrowserSelection() {
    if (selectedBrowserItem && selectedBrowserItem.el) {
        selectedBrowserItem.el.classList.remove('bg-blue-100', 'text-jupyter-blue', 'font-semibold');
    }
    selectedBrowserItem = null;
}

// File Clipboard Management (Copy, Cut, Paste)
function clearFileClipboard() {
    if (fileClipboard && fileClipboard.el) {
        fileClipboard.el.classList.remove('opacity-50');
    }
    fileClipboard = null;
}

function copySelectedFile(item = selectedBrowserItem) {
    if (!item) return;
    clearFileClipboard();
    fileClipboard = {
        action: 'copy',
        sourceRelPath: item.relPath,
        filename: item.name,
        isFolder: item.isFolder,
        el: item.el
    };
}

function cutSelectedFile(item = selectedBrowserItem) {
    if (!item) return;
    clearFileClipboard();
    fileClipboard = {
        action: 'cut',
        sourceRelPath: item.relPath,
        filename: item.name,
        isFolder: item.isFolder,
        el: item.el
    };
    if (item.el) {
        item.el.classList.add('opacity-50');
    }
}

async function moveFileOnServer(sourceRel, destRel, fileName, isFolder = false) {
    try {
        const result = await renameOnServer(sourceRel, destRel, isFolder);
        if (result.success) {
            if (!isFolder) {
                const baseName = fileName.replace(/\.md$/, '');
                updateDocumentFilename(baseName, baseName, sourceRel, destRel);
                for (const [docId, doc] of documents.entries()) {
                    if (doc.relPath === sourceRel) {
                        doc.relPath = destRel;
                        doc.dirPath = destRel.includes('/') ? destRel.substring(0, destRel.lastIndexOf('/')) : '';
                    }
                }
            } else {
                for (const [docId, doc] of documents.entries()) {
                    if (doc.relPath && (doc.relPath === sourceRel || doc.relPath.startsWith(sourceRel + '/'))) {
                        doc.relPath = destRel + doc.relPath.substring(sourceRel.length);
                        doc.dirPath = doc.relPath.includes('/') ? doc.relPath.substring(0, doc.relPath.lastIndexOf('/')) : '';
                    }
                }
            }
            await loadFileList();
            return { success: true };
        } else {
            alert('Failed to move: ' + (result.error || 'Unknown error'));
            return { success: false, error: result.error };
        }
    } catch (err) {
        console.error('Move error:', err);
        alert('Error moving: ' + err.message);
        return { success: false, error: err.message };
    }
}

async function copyFileOnServer(sourceRel, destDir, fileName, isFolder = false) {
    try {
        const response = await fetch('/api/copy-file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                src_path: sourceRel,
                dest_dir: destDir,
                is_folder: isFolder
            })
        });
        const data = await response.json();
        if (response.ok) {
            await loadFileList();
            return { success: true, filename: data.filename };
        } else {
            alert('Failed to copy: ' + (data.detail || 'Unknown error'));
            return { success: false, error: data.detail };
        }
    } catch (err) {
        console.error('Copy error:', err);
        alert('Error copying: ' + err.message);
        return { success: false, error: err.message };
    }
}

async function pasteFileToDirectory(destDir = currentBrowsePath) {
    if (!fileClipboard || !fileClipboard.sourceRelPath) return;

    const sourceRel = fileClipboard.sourceRelPath;
    const fileName = fileClipboard.filename;
    const isFolder = !!fileClipboard.isFolder;

    if (fileClipboard.action === 'cut') {
        const destRel = destDir ? `${destDir}/${fileName}` : fileName;
        if (sourceRel === destRel) {
            clearFileClipboard();
            return;
        }
        await moveFileOnServer(sourceRel, destRel, fileName, isFolder);
        clearFileClipboard();
    } else if (fileClipboard.action === 'copy') {
        await copyFileOnServer(sourceRel, destDir, fileName, isFolder);
    }
}

// File Operations (Load, Save, New, Delete)
async function loadFileList() {
    try {
        const query = currentBrowsePath ? `?path=${encodeURIComponent(currentBrowsePath)}` : '';
        const response = await fetch(`/api/files${query}`);
        if (!response.ok) {
            console.error('Failed to load file list:', response.statusText);
            if (currentBrowsePath !== '') {
                currentBrowsePath = '';
                return await loadFileList();
            }
            return;
        }
        const data = await response.json();
        existingFolders = data.directories || [];
        existingFiles = data.files || [];
        renderBreadcrumbs();
        renderFileList(existingFolders, existingFiles);
    } catch (err) {
        console.error('Failed to load file list:', err);
    }
}

// Breadcrumbs Navigation (JupyterLab style: [Folder icon]/subfolder/)
function renderBreadcrumbs() {
    if (!breadcrumbBar) return;
    breadcrumbBar.innerHTML = '';

    // Root folder icon
    const rootBtn = document.createElement('span');
    rootBtn.className = 'breadcrumb-item flex items-center text-jupyter-blue hover:text-blue-700 cursor-pointer p-0.5 rounded transition-colors';
    rootBtn.title = 'Root Directory';
    rootBtn.innerHTML = '<i class="fa-solid fa-folder text-sm"></i>';
    rootBtn.addEventListener('click', () => {
        if (currentBrowsePath !== '') {
            currentBrowsePath = '';
            loadFileList();
        }
    });

    rootBtn.addEventListener('dragover', (e) => {
        if (e.dataTransfer && e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('application/x-app-file')) {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';
            rootBtn.classList.add('bg-blue-100', 'ring-1', 'ring-jupyter-blue');
        }
    });
    rootBtn.addEventListener('dragleave', () => {
        rootBtn.classList.remove('bg-blue-100', 'ring-1', 'ring-jupyter-blue');
    });
    rootBtn.addEventListener('drop', async (e) => {
        if (e.dataTransfer && e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('application/x-app-file')) {
            e.preventDefault();
            e.stopPropagation();
            rootBtn.classList.remove('bg-blue-100', 'ring-1', 'ring-jupyter-blue');
            const sourceRel = e.dataTransfer.getData('application/x-app-relpath');
            const fileName = e.dataTransfer.getData('application/x-app-file');
            const isFolder = e.dataTransfer.getData('application/x-app-is-folder') === 'true';
            if (!sourceRel || !fileName) return;
            const destRel = fileName;
            if (sourceRel === destRel) return;
            await moveFileOnServer(sourceRel, destRel, fileName, isFolder);
        }
    });

    breadcrumbBar.appendChild(rootBtn);

    const rootSlash = document.createElement('span');
    rootSlash.className = 'text-gray-400 mx-1 select-none font-bold';
    rootSlash.textContent = '/';
    breadcrumbBar.appendChild(rootSlash);

    if (currentBrowsePath) {
        const parts = currentBrowsePath.split('/').filter(p => p.length > 0);
        let accumulated = '';
        parts.forEach((part) => {
            accumulated = accumulated ? `${accumulated}/${part}` : part;
            const targetPath = accumulated;

            const partSpan = document.createElement('span');
            partSpan.className = 'breadcrumb-item text-gray-700 hover:text-jupyter-blue cursor-pointer truncate max-w-[90px] inline-block align-bottom font-medium p-0.5 rounded transition-colors';
            partSpan.title = targetPath;
            partSpan.textContent = part;

            partSpan.addEventListener('click', () => {
                if (currentBrowsePath !== targetPath) {
                    currentBrowsePath = targetPath;
                    loadFileList();
                }
            });

            partSpan.addEventListener('dragover', (e) => {
                if (e.dataTransfer && e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('application/x-app-file')) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.dataTransfer.dropEffect = 'move';
                    partSpan.classList.add('bg-blue-100', 'ring-1', 'ring-jupyter-blue');
                }
            });
            partSpan.addEventListener('dragleave', () => {
                partSpan.classList.remove('bg-blue-100', 'ring-1', 'ring-jupyter-blue');
            });
            partSpan.addEventListener('drop', async (e) => {
                if (e.dataTransfer && e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('application/x-app-file')) {
                    e.preventDefault();
                    e.stopPropagation();
                    partSpan.classList.remove('bg-blue-100', 'ring-1', 'ring-jupyter-blue');
                    const sourceRel = e.dataTransfer.getData('application/x-app-relpath');
                    const fileName = e.dataTransfer.getData('application/x-app-file');
                    const isFolder = e.dataTransfer.getData('application/x-app-is-folder') === 'true';
                    if (!sourceRel || !fileName) return;
                    const destRel = `${targetPath}/${fileName}`;
                    if (sourceRel === destRel) return;
                    if (isFolder && (destRel === sourceRel || destRel.startsWith(sourceRel + '/'))) {
                        alert('Cannot move a directory into itself.');
                        return;
                    }
                    await moveFileOnServer(sourceRel, destRel, fileName, isFolder);
                }
            });

            breadcrumbBar.appendChild(partSpan);

            const slash = document.createElement('span');
            slash.className = 'text-gray-400 mx-1 select-none font-bold';
            slash.textContent = '/';
            breadcrumbBar.appendChild(slash);
        });
    }
}

function renderFileList(directories, files) {
    fileListContainer.innerHTML = '';
    if (directories.length === 0 && files.length === 0) {
        fileListContainer.innerHTML = '<div class="text-gray-400 text-center py-4 text-xs">No files found</div>';
        return;
    }

    // 1. Folders first (top)
    directories.forEach(dirName => {
        const fullRelPath = currentBrowsePath ? `${currentBrowsePath}/${dirName}` : dirName;
        const dirEl = document.createElement('div');
        dirEl.className = 'flex items-center px-2 py-1.5 hover:bg-gray-200 rounded cursor-pointer transition-colors space-x-2 text-gray-700 truncate select-none';
        dirEl.setAttribute('data-folder', dirName);
        dirEl.setAttribute('data-rel-path', fullRelPath);
        dirEl.setAttribute('draggable', 'true');
        dirEl.innerHTML = `<i class="fa-solid fa-folder text-blue-500 flex-shrink-0 text-xs"></i><span class="truncate font-medium text-xs">${dirName}</span>`;

        // Check if cut in clipboard
        if (fileClipboard && fileClipboard.action === 'cut' && fileClipboard.sourceRelPath === fullRelPath) {
            dirEl.classList.add('opacity-50');
            fileClipboard.el = dirEl;
        }

        // Check if selected
        if (selectedBrowserItem && selectedBrowserItem.relPath === fullRelPath) {
            dirEl.classList.add('bg-blue-100', 'text-jupyter-blue', 'font-semibold');
            selectedBrowserItem.el = dirEl;
        }

        // Single click: select folder
        dirEl.addEventListener('click', (e) => {
            e.stopPropagation();
            selectBrowserItem(dirName, true, fullRelPath, dirEl);
        });

        // Double click: navigate into folder
        dirEl.addEventListener('dblclick', (e) => {
            e.preventDefault();
            e.stopPropagation();
            currentBrowsePath = fullRelPath;
            loadFileList();
        });

        // Drag start (allow moving this folder)
        dirEl.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('application/x-app-file', dirName);
            e.dataTransfer.setData('application/x-app-relpath', fullRelPath);
            e.dataTransfer.setData('application/x-app-is-folder', 'true');
            e.dataTransfer.effectAllowed = 'move';
            selectBrowserItem(dirName, true, fullRelPath, dirEl);
            dirEl.classList.add('opacity-50');
        });

        dirEl.addEventListener('dragend', () => {
            if (!fileClipboard || fileClipboard.sourceRelPath !== fullRelPath || fileClipboard.action !== 'cut') {
                dirEl.classList.remove('opacity-50');
            }
        });

        // Drag over / drop target (drop file into this folder)
        dirEl.addEventListener('dragover', (e) => {
            if (e.dataTransfer && e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('application/x-app-file')) {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'move';
                dirEl.classList.add('bg-blue-100', 'ring-2', 'ring-jupyter-blue');
            }
        });

        dirEl.addEventListener('dragleave', () => {
            dirEl.classList.remove('bg-blue-100', 'ring-2', 'ring-jupyter-blue');
        });

        dirEl.addEventListener('drop', async (e) => {
            if (e.dataTransfer && e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('application/x-app-file')) {
                e.preventDefault();
                e.stopPropagation();
                dirEl.classList.remove('bg-blue-100', 'ring-2', 'ring-jupyter-blue');

                const sourceRel = e.dataTransfer.getData('application/x-app-relpath');
                const fileName = e.dataTransfer.getData('application/x-app-file');
                const isFolder = e.dataTransfer.getData('application/x-app-is-folder') === 'true';

                if (!sourceRel || !fileName) return;

                const destRel = `${fullRelPath}/${fileName}`;
                if (sourceRel === destRel) return;

                if (isFolder && (destRel === sourceRel || destRel.startsWith(sourceRel + '/'))) {
                    alert('Cannot move a directory into itself.');
                    return;
                }

                await moveFileOnServer(sourceRel, destRel, fileName, isFolder);
            }
        });

        // Right-click: context menu (Copy, Cut, Paste, Rename, Delete)
        dirEl.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (cellStateBeforeRename === null) {
                saveCellStateBeforeRename();
            }
            selectBrowserItem(dirName, true, fullRelPath, dirEl);

            fileContextMenu.classList.remove('hidden');
            const listRect = fileListContainer.getBoundingClientRect();
            const threshold = listRect.bottom - (listRect.height / 3);
            if (e.clientY > threshold) {
                fileContextMenu.style.left = `${e.clientX + 5}px`;
                fileContextMenu.style.top = `${e.clientY - fileContextMenu.offsetHeight}px`;
            } else {
                fileContextMenu.style.left = `${e.clientX}px`;
                fileContextMenu.style.top = `${e.clientY}px`;
            }
            fileContextMenu.setAttribute('data-target-name', dirName);
            fileContextMenu.setAttribute('data-target-file', dirName);
            fileContextMenu.setAttribute('data-is-folder', 'true');
            fileContextMenu.setAttribute('data-rel-path', fullRelPath);
            fileContextMenu.setAttribute('data-paste-dir', fullRelPath);

            if (contextCopyBtn) contextCopyBtn.classList.remove('hidden');
            if (contextCutBtn) contextCutBtn.classList.remove('hidden');
            if (contextPasteBtn) {
                if (fileClipboard && fileClipboard.sourceRelPath) {
                    contextPasteBtn.classList.remove('hidden', 'opacity-50', 'pointer-events-none');
                    contextPasteBtn.removeAttribute('disabled');
                } else {
                    contextPasteBtn.classList.add('hidden');
                }
            }
            if (contextDivider) contextDivider.classList.remove('hidden');
            if (contextRenameBtn) contextRenameBtn.classList.remove('hidden');
            if (contextDeleteBtn) contextDeleteBtn.classList.remove('hidden');
        });

        fileListContainer.appendChild(dirEl);
    });

    // 2. Files below
    files.forEach(file => {
        const fullRelPath = currentBrowsePath ? `${currentBrowsePath}/${file}` : file;
        const fileEl = document.createElement('div');
        fileEl.className = 'flex items-center px-2 py-1.5 hover:bg-gray-200 rounded cursor-pointer transition-colors space-x-2 text-gray-700 truncate select-none';
        fileEl.setAttribute('data-file', file);
        fileEl.setAttribute('data-rel-path', fullRelPath);
        fileEl.setAttribute('draggable', 'true');
        const iconClass = getFileIconClass(file);
        fileEl.innerHTML = `<i class="${iconClass} flex-shrink-0 text-xs"></i><span class="truncate font-medium text-xs">${file}</span>`;

        // Check if cut in clipboard
        if (fileClipboard && fileClipboard.action === 'cut' && fileClipboard.sourceRelPath === fullRelPath) {
            fileEl.classList.add('opacity-50');
            fileClipboard.el = fileEl;
        }

        // Check if selected
        if (selectedBrowserItem && selectedBrowserItem.relPath === fullRelPath) {
            fileEl.classList.add('bg-blue-100', 'text-jupyter-blue', 'font-semibold');
            selectedBrowserItem.el = fileEl;
        }

        // Click
        fileEl.addEventListener('click', (e) => {
            selectBrowserItem(file, false, fullRelPath, fileEl);
            handleFileClick(file);
        });

        // Double click
        fileEl.addEventListener('dblclick', (e) => {
            selectBrowserItem(file, false, fullRelPath, fileEl);
            handleFileClick(file);
        });

        // Drag start (allow moving this file)
        fileEl.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('application/x-app-file', file);
            e.dataTransfer.setData('application/x-app-relpath', fullRelPath);
            e.dataTransfer.setData('application/x-app-is-folder', 'false');
            e.dataTransfer.effectAllowed = 'move';
            selectBrowserItem(file, false, fullRelPath, fileEl);
            fileEl.classList.add('opacity-50');
        });

        fileEl.addEventListener('dragend', () => {
            if (!fileClipboard || fileClipboard.sourceRelPath !== fullRelPath || fileClipboard.action !== 'cut') {
                fileEl.classList.remove('opacity-50');
            }
        });

        // Right-click: context menu (Copy, Cut, Rename, Delete)
        fileEl.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (cellStateBeforeRename === null) {
                saveCellStateBeforeRename();
            }
            selectBrowserItem(file, false, fullRelPath, fileEl);

            fileContextMenu.classList.remove('hidden');
            const listRect = fileListContainer.getBoundingClientRect();
            const threshold = listRect.bottom - (listRect.height / 3);
            if (e.clientY > threshold) {
                fileContextMenu.style.left = `${e.clientX + 5}px`;
                fileContextMenu.style.top = `${e.clientY - fileContextMenu.offsetHeight}px`;
            } else {
                fileContextMenu.style.left = `${e.clientX}px`;
                fileContextMenu.style.top = `${e.clientY}px`;
            }
            fileContextMenu.setAttribute('data-target-name', file);
            fileContextMenu.setAttribute('data-target-file', file);
            fileContextMenu.setAttribute('data-is-folder', 'false');
            fileContextMenu.setAttribute('data-rel-path', fullRelPath);

            if (contextCopyBtn) contextCopyBtn.classList.remove('hidden');
            if (contextCutBtn) contextCutBtn.classList.remove('hidden');
            if (contextPasteBtn) contextPasteBtn.classList.add('hidden');
            if (contextDivider) contextDivider.classList.remove('hidden');
            if (contextRenameBtn) contextRenameBtn.classList.remove('hidden');
            if (contextDeleteBtn) contextDeleteBtn.classList.remove('hidden');
        });

        fileListContainer.appendChild(fileEl);
    });
}

// Handle opening a file into tabs
async function handleFileClick(filename) {
    const fileType = getFileType(filename);
    const fullRelPath = currentBrowsePath ? `${currentBrowsePath}/${filename}` : filename;

    // 1. Markdown notebook
    if (fileType === 'notebook') {
        const baseName = filename.replace(/\.md$/, '');

        // Check if already open in any visible pane
        for (const [docId, doc] of documents.entries()) {
            if ((!doc.fileType || doc.fileType === 'notebook') && (doc.relPath === fullRelPath || (!doc.relPath && doc.filename === baseName))) {
                for (let i = 0; i < openPaneCount; i++) {
                    if (panes[i].tabs.includes(docId)) {
                        showNotebookWorkspace();
                        setActivePane(i);
                        switchTab(i, docId);
                        return;
                    }
                }
            }
        }

        // Fetch from server and add to active pane
        try {
            const response = await fetch(`/api/load/${encodeURIComponent(fullRelPath).replace(/%2F/g, '/')}`);
            if (!response.ok) {
                alert('Failed to load file');
                return;
            }
            const data = await response.json();

            const doc = createDocumentModel(data.filename, data.content, false, data.rel_path, currentBrowsePath);
            documents.set(doc.id, doc);

            const targetPaneIdx = activePaneIndex;
            panes[targetPaneIdx].tabs.push(doc.id);
            panes[targetPaneIdx].activeTabId = doc.id;

            showNotebookWorkspace();
            setActivePane(targetPaneIdx);
            renderPane(targetPaneIdx);
        } catch (err) {
            console.error('Error loading file:', err);
            alert('Error loading file: ' + err.message);
        }
        return;
    }

    // 2. Previewable file types (image, pdf, text, video, audio)
    if (['image', 'pdf', 'text', 'video', 'audio'].includes(fileType)) {
        // Check if already open in any visible pane
        for (const [docId, doc] of documents.entries()) {
            if (doc.relPath === fullRelPath || doc.filename === filename) {
                for (let i = 0; i < openPaneCount; i++) {
                    if (panes[i].tabs.includes(docId)) {
                        showNotebookWorkspace();
                        setActivePane(i);
                        switchTab(i, docId);
                        return;
                    }
                }
            }
        }

        let content = '';
        if (fileType === 'text') {
            try {
                const rawUrl = `/api/raw-file?path=${encodeURIComponent(fullRelPath).replace(/%2F/g, '/')}`;
                const res = await fetch(rawUrl);
                if (res.ok) {
                    content = await res.text();
                } else {
                    alert('Failed to load file content');
                    return;
                }
            } catch (err) {
                console.error('Error loading text file:', err);
                alert('Error loading file: ' + err.message);
                return;
            }
        }

        const doc = createViewerDocumentModel(filename, fullRelPath, currentBrowsePath, fileType, content);
        documents.set(doc.id, doc);

        const targetPaneIdx = activePaneIndex;
        panes[targetPaneIdx].tabs.push(doc.id);
        panes[targetPaneIdx].activeTabId = doc.id;

        showNotebookWorkspace();
        setActivePane(targetPaneIdx);
        renderPane(targetPaneIdx);
        return;
    }

    // 3. Other files: prompt download
    const rawUrl = `/api/raw-file?path=${encodeURIComponent(fullRelPath).replace(/%2F/g, '/')}`;
    const wantDownload = confirm(`"${filename}" cannot be previewed directly in the editor. Would you like to download it?`);
    if (wantDownload) {
        const a = document.createElement('a');
        a.href = rawUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
}

// Create New File button (JupyterLab style Option A: on-disk creation)
async function handleNewFileBtn() {
    try {
        const response = await fetch('/api/create-file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                path: currentBrowsePath,
                filename: 'untitled.md'
            })
        });
        const data = await response.json();
        if (response.ok) {
            await loadFileList();
            const doc = createDocumentModel(data.filename, '', true, data.rel_path, currentBrowsePath);
            doc.isModified = false;
            documents.set(doc.id, doc);

            const targetPaneIdx = activePaneIndex;
            panes[targetPaneIdx].tabs.push(doc.id);
            panes[targetPaneIdx].activeTabId = doc.id;

            showNotebookWorkspace();
            setActivePane(targetPaneIdx);
            renderPane(targetPaneIdx);

            setTimeout(() => {
                const firstCell = doc.cells[0];
                if (firstCell) {
                    const textarea = document.getElementById(`textarea-${firstCell.id}`);
                    if (textarea) {
                        textarea.focus();
                        autoResizeTextarea(textarea, targetPaneIdx);
                    }
                }
            }, 60);
        } else {
            alert('Failed to create new file: ' + (data.detail || 'Unknown error'));
        }
    } catch (err) {
        console.error('Error creating file:', err);
        alert('Error creating file: ' + err.message);
    }
}

// Create New Folder button (JupyterLab style Option A: inline rename on create)
async function handleNewFolderBtn() {
    try {
        const response = await fetch('/api/create-folder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                path: currentBrowsePath,
                name: 'new_folder'
            })
        });
        const data = await response.json();
        if (response.ok) {
            const folderName = data.folder_name;
            await loadFileList();
            startInlineRenameFolder(folderName);
        } else {
            alert('Failed to create folder: ' + (data.detail || 'Unknown error'));
        }
    } catch (err) {
        console.error('Error creating folder:', err);
        alert('Error creating folder: ' + err.message);
    }
}

// Create New Notebook (via Menu, Empty State, Tab +, or Shortcut)
async function createNewNotebook() {
    await handleNewFileBtn();
}

// Save Notebook
async function saveNotebook(targetDoc = null) {
    const doc = targetDoc || getActiveDocument();
    if (!doc || doc.cells.length === 0) return false;

    syncEditingTextareas(doc);

    let filename = doc.filename.trim();
    if (!filename) {
        alert('Please enter a valid filename.');
        return false;
    }

    let filenameWithExt = filename;
    if (!filenameWithExt.endsWith('.md')) {
        filenameWithExt += '.md';
    }

    const saveRelPath = doc.relPath || (doc.dirPath ? `${doc.dirPath}/${filenameWithExt}` : filenameWithExt);

    const fileExists = existingFiles.includes(filenameWithExt);
    if (doc.isNew && !doc.relPath && fileExists) {
        const sameFile = existingFiles.find(f => f.toLowerCase() === filenameWithExt.toLowerCase());
        if (sameFile && doc.filename === 'untitled') {
            const confirmOverwrite = confirm(`File "${filenameWithExt}" already exists. Overwrite it?`);
            if (!confirmOverwrite) return false;
        }
    }

    const fileContent = doc.cells.map(cell => cell.content.trim()).join('\n\n<!-- cell -->\n\n');

    try {
        const response = await fetch('/api/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filename: saveRelPath,
                content: fileContent
            })
        });

        const data = await response.json();
        if (response.ok) {
            doc.filename = data.filename.replace(/\.md$/, '');
            doc.relPath = data.rel_path;
            if (data.rel_path.includes('/')) {
                doc.dirPath = data.rel_path.substring(0, data.rel_path.lastIndexOf('/'));
            } else {
                doc.dirPath = '';
            }
            markModified(false, doc);
            loadFileList();
            for (let i = 0; i < openPaneCount; i++) {
                if (panes[i].activeTabId === doc.id) {
                    panes[i].nameInputEl.value = doc.filename;
                }
                if (panes[i].tabs.includes(doc.id)) {
                    renderTabs(i);
                }
            }
            return true;
        } else {
            alert('Error saving notebook: ' + data.detail);
            return false;
        }
    } catch (err) {
        console.error('Save error:', err);
        alert('Failed to save notebook: ' + err.message);
        return false;
    }
}

// Save Notebook As...
async function saveNotebookAs() {
    const doc = getActiveDocument();
    if (!doc || (doc.fileType && doc.fileType !== 'notebook')) return false;

    let newName = prompt('Save As (Enter filename without .md):', doc.filename || 'untitled');
    if (newName === null) return false;
    newName = newName.trim();
    if (!newName) {
        alert('Invalid filename.');
        return false;
    }
    doc.filename = newName.replace(/\.md$/, '');
    doc.relPath = doc.dirPath ? `${doc.dirPath}/${doc.filename}.md` : `${doc.filename}.md`;
    doc.isModified = true;
    return await saveNotebook(doc);
}


// Common File Save Dialog for Exporting
async function saveExportedFile(blob, defaultFilename, mimeType, extension) {
    // 1. Try File System Access API (Native OS Save Dialog)
    if (typeof window.showSaveFilePicker === 'function') {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: defaultFilename,
                types: [{
                    description: `${extension.toUpperCase()} File (*.${extension})`,
                    accept: {
                        [mimeType]: [`.${extension}`]
                    }
                }]
            });
            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
            return true;
        } catch (err) {
            if (err.name === 'AbortError') {
                // User cancelled the save dialog: abort silently without showing any dialog
                return false;
            }
            console.warn('showSaveFilePicker error, falling back to download:', err);
        }
    }

    // 2. Fallback for environments without showSaveFilePicker
    try {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = defaultFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1500);
        return true;
    } catch (fallbackErr) {
        console.error('Fallback export error:', fallbackErr);
        return false;
    }
}

// Export Notebook as clean Markdown (.md without <!-- cell -->)
async function exportMarkdown() {
    const pane = getActivePane();
    const doc = pane ? getPaneActiveDocument(activePaneIndex) : getActiveDocument();
    if (!doc || doc.cells.length === 0) {
        alert('No notebook is currently open to export.');
        return;
    }

    syncEditingTextareas(doc);

    // Filter out cell separator lines and combine
    const cleanMarkdown = doc.cells
        .map(cell => cell.content.replace(/<!--\s*cell\s*-->/g, '').trim())
        .filter(c => c.length > 0)
        .join('\n\n');

    const currentFilename = doc.filename || 'untitled.md';
    const stem = currentFilename.replace(/\.md$/i, '').trim() || 'untitled';
    const defaultFilename = `${stem}.md`;

    const blob = new Blob([cleanMarkdown], { type: 'text/markdown;charset=utf-8' });
    await saveExportedFile(blob, defaultFilename, 'text/markdown', 'md');
}

// Helper to escape HTML characters
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Build complete standalone HTML document with bundled styling
function buildStandaloneHtmlDocument(title, contentHtml) {
    return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <!-- KaTeX for Math LaTeX -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
  <!-- Highlight.js for code block highlight -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/styles/github-dark.min.css">
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #ffffff;
      color: #24292f;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      line-height: 1.6;
    }
    .markdown-container {
      max-width: 900px;
      margin: 40px auto;
      padding: 0 24px 60px 24px;
    }
    .markdown-preview h1 {
      font-size: 2em;
      font-weight: 800;
      margin-top: 1em;
      margin-bottom: 0.5em;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 0.3em;
    }
    .markdown-preview h2 {
      font-size: 1.5em;
      font-weight: 700;
      margin-top: 1em;
      margin-bottom: 0.5em;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 0.3em;
    }
    .markdown-preview h3 {
      font-size: 1.25em;
      font-weight: 600;
      margin-top: 1em;
      margin-bottom: 0.5em;
    }
    .markdown-preview h4 {
      font-size: 1.1em;
      font-weight: 600;
      margin-top: 1em;
      margin-bottom: 0.5em;
    }
    .markdown-preview p {
      margin-top: 0;
      margin-bottom: 0.8em;
      line-height: 1.6;
    }
    .markdown-preview ul {
      list-style-type: disc;
      padding-left: 2em;
      margin-bottom: 0.8em;
    }
    .markdown-preview ol {
      list-style-type: decimal;
      padding-left: 2em;
      margin-bottom: 0.8em;
    }
    .markdown-preview li {
      margin-bottom: 0.25em;
    }
    .markdown-preview blockquote {
      padding: 0 1em;
      color: #6b7280;
      border-left: 0.25em solid #e5e7eb;
      margin-bottom: 0.8em;
      font-style: italic;
    }
    .markdown-preview code {
      padding: 0.2em 0.4em;
      margin: 0;
      font-size: 85%;
      background-color: #f3f4f6;
      border-radius: 4px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
    }
    .markdown-preview pre {
      padding: 14px;
      overflow: auto;
      font-size: 87.5%;
      line-height: 1.5;
      background-color: #1e1e2e;
      border: 1px solid #313244;
      border-radius: 8px;
      margin-bottom: 1em;
    }
    .markdown-preview pre code {
      background-color: transparent;
      padding: 0;
      margin: 0;
      font-size: 100%;
      white-space: pre;
    }
    .markdown-preview pre code.hljs {
      display: block !important;
      background: #1e1e2e !important;
      color: #cdd6f4 !important;
    }
    .markdown-preview table {
      border-collapse: collapse;
      width: 100%;
      margin-bottom: 1em;
    }
    .markdown-preview th, .markdown-preview td {
      padding: 6px 13px;
      border: 1px solid #e5e7eb;
    }
    .markdown-preview th {
      font-weight: 600;
      background-color: #f9fafb;
    }
    .markdown-preview tr {
      background-color: #fff;
    }
    .markdown-preview tr:nth-child(even) {
      background-color: #f9fafb;
    }
    .markdown-preview a {
      color: #2563eb;
      text-decoration: none;
    }
    .markdown-preview a:hover {
      text-decoration: underline;
    }
    .markdown-preview hr {
      height: 0.25em;
      padding: 0;
      margin: 24px 0;
      background-color: #e5e7eb;
      border: 0;
    }
    .markdown-preview img {
      max-width: 100%;
      height: auto;
      border-radius: 4px;
      margin: 0.8em 0;
      display: block;
    }
    /* Vector Twemoji Style */
    img.emoji {
      height: 1.25em !important;
      width: 1.25em !important;
      margin: 0 0.12em !important;
      vertical-align: -0.22em !important;
      display: inline-block !important;
    }
  </style>
</head>
<body>
  <div class="markdown-container">
    <div class="markdown-preview">
      ${contentHtml}
    </div>
  </div>
</body>
</html>`;
}

// Export Notebook as HTML (Linked images / relative path)
async function exportHtml() {
    const pane = getActivePane();
    const doc = pane ? getPaneActiveDocument(activePaneIndex) : getActiveDocument();
    if (!doc || doc.cells.length === 0) {
        alert('No notebook is currently open to export.');
        return;
    }

    syncEditingTextareas(doc);

    // 1. Get combined clean markdown (without <!-- cell -->)
    const cleanMarkdown = doc.cells
        .map(cell => cell.content.replace(/<!--\s*cell\s*-->/g, '').trim())
        .filter(c => c.length > 0)
        .join('\n\n');

    // 2. Render Markdown with math (null as currentDirPath to keep relative image links)
    const renderedBody = renderMarkdownWithMath(cleanMarkdown, null);

    // 3. Highlight code blocks and normalize images in temporary container
    const tempContainer = document.createElement('div');
    tempContainer.innerHTML = renderedBody;

    if (typeof hljs !== 'undefined') {
        tempContainer.querySelectorAll('pre code').forEach(block => {
            try {
                hljs.highlightElement(block);
            } catch (e) {}
        });
    }

    // Clean leading ./ so `./example.png` becomes `example.png`
    const imgElements = Array.from(tempContainer.querySelectorAll('img:not(.emoji)'));
    imgElements.forEach(img => {
        const src = img.getAttribute('src');
        if (src && src.startsWith('./')) {
            img.setAttribute('src', src.replace(/^\.\//, ''));
        }
    });

    // Apply Twemoji vector conversion
    applyTwemojiToElement(tempContainer);

    const currentFilename = doc.filename || 'untitled.md';
    const stem = currentFilename.replace(/\.md$/i, '').trim() || 'untitled';
    const defaultFilename = `${stem}.html`;

    const fullHtml = buildStandaloneHtmlDocument(stem, tempContainer.innerHTML);
    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
    await saveExportedFile(blob, defaultFilename, 'text/html', 'html');
}

// Helper to replace inaccessible/broken images with placeholder box
function replaceWithUnavailablePlaceholder(img) {
    if (!img || !img.parentNode) return;
    const placeholder = document.createElement('div');
    placeholder.className = 'image-unavailable-placeholder';
    placeholder.textContent = 'This image is unavailable.';
    
    const width = img.getAttribute('width') || (img.style && img.style.width);
    const height = img.getAttribute('height') || (img.style && img.style.height);
    if (width) {
        placeholder.style.width = width.includes('px') || width.includes('%') ? width : `${width}px`;
    }
    if (height) {
        placeholder.style.height = height.includes('px') || height.includes('%') ? height : `${height}px`;
    }
    
    img.parentNode.replaceChild(placeholder, img);
}

// Build complete printable HTML document with embedded styling for browser native print
function buildPrintableHtmlDocument(title, contentHtml) {
    return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <!-- KaTeX for Math LaTeX -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
  <!-- Highlight.js for code block highlight -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/styles/github-dark.min.css">
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm 15mm 15mm 15mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
    }
    body {
      margin: 0;
      padding: 0;
      background-color: #ffffff;
      color: #24292f;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, "Noto Sans", sans-serif;
      line-height: 1.6;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .markdown-container {
      max-width: 100%;
      margin: 0 auto;
      padding: 0;
    }
    .markdown-preview {
      font-size: 14px;
      line-height: 1.6;
      word-break: break-word;
    }
    .markdown-preview h1 {
      font-size: 2em;
      font-weight: 800;
      margin-top: 1em;
      margin-bottom: 0.5em;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 0.3em;
    }
    .markdown-preview h2 {
      font-size: 1.5em;
      font-weight: 700;
      margin-top: 1em;
      margin-bottom: 0.5em;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 0.3em;
    }
    .markdown-preview h3 {
      font-size: 1.25em;
      font-weight: 600;
      margin-top: 1em;
      margin-bottom: 0.5em;
    }
    .markdown-preview h4 {
      font-size: 1.1em;
      font-weight: 600;
      margin-top: 1em;
      margin-bottom: 0.5em;
    }
    .markdown-preview p {
      margin-top: 0;
      margin-bottom: 0.8em;
      line-height: 1.6;
    }
    .markdown-preview ul {
      list-style-type: disc;
      padding-left: 2em;
      margin-bottom: 0.8em;
    }
    .markdown-preview ol {
      list-style-type: decimal;
      padding-left: 2em;
      margin-bottom: 0.8em;
    }
    .markdown-preview li {
      margin-bottom: 0.25em;
    }
    .markdown-preview blockquote {
      padding: 0 1em;
      color: #6b7280;
      border-left: 0.25em solid #e5e7eb;
      margin-bottom: 0.8em;
      font-style: italic;
    }
    .markdown-preview code {
      padding: 0.2em 0.4em;
      margin: 0;
      font-size: 85%;
      background-color: #f3f4f6;
      border-radius: 4px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
    }
    .markdown-preview pre {
      padding: 14px;
      overflow: visible;
      font-size: 87.5%;
      line-height: 1.5;
      background-color: #1e1e2e;
      border: 1px solid #313244;
      border-radius: 8px;
      margin-bottom: 1em;
    }
    .markdown-preview pre code {
      background-color: transparent;
      padding: 0;
      margin: 0;
      font-size: 100%;
      white-space: pre-wrap;
      word-break: break-all;
    }
    .markdown-preview pre code.hljs {
      display: block !important;
      background: #1e1e2e !important;
      color: #cdd6f4 !important;
    }
    .markdown-preview table {
      border-collapse: collapse;
      width: 100%;
      margin-bottom: 1em;
    }
    .markdown-preview th, .markdown-preview td {
      padding: 6px 13px;
      border: 1px solid #e5e7eb;
    }
    .markdown-preview th {
      font-weight: 600;
      background-color: #f9fafb;
    }
    .markdown-preview tr {
      background-color: #fff;
    }
    .markdown-preview tr:nth-child(even) {
      background-color: #f9fafb;
    }
    .markdown-preview a {
      color: #2563eb;
      text-decoration: none;
    }
    .markdown-preview a:hover {
      text-decoration: underline;
    }
    .markdown-preview hr {
      height: 0.25em;
      padding: 0;
      margin: 24px 0;
      background-color: #e5e7eb;
      border: 0;
    }
    .markdown-preview img {
      max-width: 100%;
      height: auto;
      border-radius: 4px;
      margin: 0.8em 0;
      display: block;
    }
    /* Vector Twemoji Style */
    img.emoji {
      height: 1.25em !important;
      width: 1.25em !important;
      margin: 0 0.12em !important;
      vertical-align: -0.22em !important;
      display: inline-block !important;
    }
    /* Placeholder for unavailable images */
    .image-unavailable-placeholder {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      max-width: 500px;
      height: 100px;
      background-color: #f8fafc;
      border: 1.5px dashed #cbd5e1;
      border-radius: 6px;
      color: #64748b;
      font-size: 13px;
      font-weight: 500;
      margin: 1em 0;
    }
    /* Page Break rules to avoid slicing */
    p, pre, blockquote, table, tr, img, .katex-display, .image-unavailable-placeholder, ul, ol, li {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    h1, h2, h3, h4, h5, h6 {
      page-break-after: avoid !important;
      break-after: avoid !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
  </style>
</head>
<body>
  <div class="markdown-container">
    <div class="markdown-preview">
      ${contentHtml}
    </div>
  </div>
</body>
</html>`;
}

// Export Notebook as PDF (.pdf) via native browser print
async function exportPdf() {
    const pane = getActivePane();
    const doc = pane ? getPaneActiveDocument(activePaneIndex) : getActiveDocument();
    if (!doc || doc.cells.length === 0) {
        alert('No notebook is currently open to export.');
        return;
    }

    syncEditingTextareas(doc);

    // 1. Get combined clean markdown (without <!-- cell -->)
    const cleanMarkdown = doc.cells
        .map(cell => cell.content.replace(/<!--\s*cell\s*-->/g, '').trim())
        .filter(c => c.length > 0)
        .join('\n\n');

    // 2. Render Markdown with math
    const renderedBody = renderMarkdownWithMath(cleanMarkdown, doc.dirPath || '');

    // 3. Highlight code blocks and normalize images in temporary container
    const pdfContainer = document.createElement('div');
    pdfContainer.innerHTML = renderedBody;

    if (typeof hljs !== 'undefined') {
        pdfContainer.querySelectorAll('pre code').forEach(block => {
            try {
                hljs.highlightElement(block);
            } catch (e) {}
        });
    }

    // 4. Resolve images to Base64 (to ensure local & external images are fully embedded)
    const imgElements = Array.from(pdfContainer.querySelectorAll('img:not(.emoji)'));
    const pathsToFetch = new Set();
    imgElements.forEach(img => {
        const src = img.getAttribute('src') || '';
        if (src && !src.startsWith('data:')) {
            pathsToFetch.add(src);
        }
    });

    if (pathsToFetch.size > 0) {
        try {
            const res = await fetch('/api/convert-images-base64', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    paths: Array.from(pathsToFetch),
                    current_dir: doc.dirPath || ''
                })
            });
            if (res.ok) {
                const data = await res.json();
                const mapping = data.mapping || {};
                imgElements.forEach(img => {
                    const src = img.getAttribute('src');
                    const converted = mapping[src];
                    if (converted && converted.startsWith('data:')) {
                        img.setAttribute('src', converted);
                    } else if (converted === 'unavailable') {
                        replaceWithUnavailablePlaceholder(img);
                    }
                });
            }
        } catch (err) {
            console.warn('Failed to convert images for PDF:', err);
        }
    }

    // 5. Apply Twemoji vector conversion for crisp, colorful emoji rendering in print PDF
    applyTwemojiToElement(pdfContainer);

    const currentFilename = doc.filename || 'untitled.md';
    const stem = currentFilename.replace(/\.md$/i, '').trim() || 'untitled';

    // 6. Build standalone printable document HTML
    const printableHtml = buildPrintableHtmlDocument(stem, pdfContainer.innerHTML);

    // 7. Render inside a hidden iframe and trigger native browser print
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);

    const cleanup = () => {
        setTimeout(() => {
            if (iframe && iframe.parentNode) {
                document.body.removeChild(iframe);
            }
        }, 1000);
    };

    iframe.onload = () => {
        try {
            // Wait for all images inside iframe to finish loading before printing
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            const ifrImages = Array.from(iframeDoc.querySelectorAll('img'));
            const imgPromises = ifrImages.map(img => {
                if (img.complete && img.naturalWidth > 0) return Promise.resolve();
                return new Promise(res => {
                    img.onload = () => res();
                    img.onerror = () => res();
                });
            });

            Promise.all(imgPromises).then(() => {
                setTimeout(() => {
                    iframe.contentWindow.focus();
                    iframe.contentWindow.print();
                    cleanup();
                }, 250);
            });
        } catch (err) {
            console.error('Print iframe error:', err);
            cleanup();
        }
    };

    const docToWrite = iframe.contentDocument || iframe.contentWindow.document;
    docToWrite.open();
    docToWrite.write(printableHtml);
    docToWrite.close();
}

// Split Editor Vertically at target pane using a specific tab (drag-and-drop or explicit target)
function splitPaneAt(targetPaneIdx, draggedTabId, srcPaneIdx) {
    if (openPaneCount >= MAX_PANES) {
        return;
    }

    isSwitchingTabOrPane = true;
    showNotebookWorkspace();

    const effectiveSrcIdx = (srcPaneIdx !== undefined && srcPaneIdx !== null) ? srcPaneIdx : activePaneIndex;
    const curActiveDoc = getPaneActiveDocument(effectiveSrcIdx);
    if (curActiveDoc) {
        syncDocEditingState(curActiveDoc);
    }

    // Determine target slot for the new pane
    // If targetPaneIdx === 0 and openPaneCount === 2:
    // Insert new pane between 0 and 1, shifting old pane 1 to pane 2.
    const isInsertMiddle = (targetPaneIdx === 0 && openPaneCount === 2);
    const newPaneIdx = isInsertMiddle ? 1 : openPaneCount;

    // Handle shift if inserting in the middle
    if (isInsertMiddle) {
        panes[2].tabs = [...panes[1].tabs];
        panes[2].activeTabId = panes[1].activeTabId;
        panes[1].tabs = [];
        panes[1].activeTabId = null;
    }

    // Source pane where the dragged tab came from
    // Note: if isInsertMiddle and dragged tab was from pane 1, it's now shifted to pane 2!
    const actualSrcPane = (isInsertMiddle && effectiveSrcIdx === 1) ? panes[2] : panes[effectiveSrcIdx];

    let tabToMove = draggedTabId;
    if (!tabToMove && actualSrcPane) {
        tabToMove = actualSrcPane.activeTabId;
    }

    if (actualSrcPane && tabToMove) {
        const tabPos = actualSrcPane.tabs.indexOf(tabToMove);
        if (tabPos !== -1) {
            actualSrcPane.tabs.splice(tabPos, 1);
            if (actualSrcPane.tabs.length > 0) {
                if (actualSrcPane.activeTabId === tabToMove) {
                    actualSrcPane.activeTabId = actualSrcPane.tabs[Math.max(0, tabPos - 1)];
                }
            } else {
                // srcPane has no tabs left, create an untitled doc
                const newDoc = createDocumentModel('untitled', '', true);
                documents.set(newDoc.id, newDoc);
                actualSrcPane.tabs = [newDoc.id];
                actualSrcPane.activeTabId = newDoc.id;
            }
        }
    }

    // Place tabToMove in newPane
    const newPane = panes[newPaneIdx];
    if (tabToMove) {
        newPane.tabs = [tabToMove];
        newPane.activeTabId = tabToMove;
    } else {
        const newDoc = createDocumentModel('untitled', '', true);
        documents.set(newDoc.id, newDoc);
        newPane.tabs = [newDoc.id];
        newPane.activeTabId = newDoc.id;
    }

    openPaneCount++;
    updatePanesLayout();

    setActivePane(newPaneIdx);

    for (let p = 0; p < openPaneCount; p++) {
        renderPane(p);
    }

    focusActiveCellIfEditing(newPaneIdx);

    setTimeout(() => {
        isSwitchingTabOrPane = false;
    }, 150);
}

// Split Editor Vertically (Supports up to 3 Panes)
function splitPaneVertically() {
    if (openPaneCount >= MAX_PANES) {
        // Already at max 3 panes, cycle focus to next pane
        setActivePane((activePaneIndex + 1) % openPaneCount);
        return;
    }

    const curPane = panes[activePaneIndex];
    if (curPane.tabs.length > 1) {
        splitPaneAt(activePaneIndex, curPane.activeTabId, activePaneIndex);
    } else {
        isSwitchingTabOrPane = true;
        showNotebookWorkspace();

        const curActiveDoc = getPaneActiveDocument(activePaneIndex);
        if (curActiveDoc) {
            syncDocEditingState(curActiveDoc);
        }

        const newPaneIdx = openPaneCount; // 1 (second pane) or 2 (third pane)
        const newDoc = createDocumentModel('untitled', '', true);
        documents.set(newDoc.id, newDoc);

        panes[newPaneIdx].tabs = [newDoc.id];
        panes[newPaneIdx].activeTabId = newDoc.id;

        openPaneCount++;
        updatePanesLayout();

        setActivePane(newPaneIdx);

        for (let p = 0; p < openPaneCount; p++) {
            renderPane(p);
        }

        focusActiveCellIfEditing(newPaneIdx);

        setTimeout(() => {
            isSwitchingTabOrPane = false;
        }, 150);
    }
}

// Close Split Pane (menu action: closes the last pane and merges its tabs to left)
function closeSplitPane() {
    if (openPaneCount <= 1) return;
    closePane(openPaneCount - 1);
}

// Setup Dividers Resizer for Split Panes (Supports divider-0 and divider-1)
function setupDividersResizer() {
    const dividers = [
        document.getElementById('divider-0'),
        document.getElementById('divider-1')
    ];

    dividers.forEach((divider, divIdx) => {
        if (!divider) return;

        let isDragging = false;

        divider.addEventListener('mousedown', (e) => {
            isDragging = true;
            divider.classList.add('dragging');
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging || openPaneCount <= 1) return;
            const containerRect = notebookContainer.getBoundingClientRect();
            const totalWidth = containerRect.width;

            // Two-pane mode: divider-0 resizes pane-0 and pane-1
            if (openPaneCount === 2) {
                const offsetX = e.clientX - containerRect.left;
                const minWidth = totalWidth * 0.15;
                const maxWidth = totalWidth * 0.85;
                const clampedX = Math.max(minWidth, Math.min(maxWidth, offsetX));

                const p0Percent = (clampedX / totalWidth) * 100;
                const p1Percent = 100 - p0Percent;

                panes[0].containerEl.style.flex = `0 0 ${p0Percent}%`;
                panes[1].containerEl.style.flex = `0 0 ${p1Percent}%`;
            }
            // Three-pane mode
            else if (openPaneCount === 3) {
                const offsetX = e.clientX - containerRect.left;
                const p0Width = panes[0].containerEl.getBoundingClientRect().width;
                const p1Width = panes[1].containerEl.getBoundingClientRect().width;
                const p2Width = panes[2].containerEl.getBoundingClientRect().width;

                if (divIdx === 0) {
                    // Divider 0 adjusts pane-0 and pane-1
                    const minWidth = 180;
                    const maxP0 = (p0Width + p1Width) - minWidth;
                    const newP0 = Math.max(minWidth, Math.min(maxP0, offsetX));
                    const newP1 = (p0Width + p1Width) - newP0;

                    panes[0].containerEl.style.flex = `0 0 ${newP0}px`;
                    panes[1].containerEl.style.flex = `0 0 ${newP1}px`;
                } else if (divIdx === 1) {
                    // Divider 1 adjusts pane-1 and pane-2
                    const offsetFromP1Start = e.clientX - panes[1].containerEl.getBoundingClientRect().left;
                    const minWidth = 180;
                    const maxP1 = (p1Width + p2Width) - minWidth;
                    const newP1 = Math.max(minWidth, Math.min(maxP1, offsetFromP1Start));
                    const newP2 = (p1Width + p2Width) - newP1;

                    panes[1].containerEl.style.flex = `0 0 ${newP1}px`;
                    panes[2].containerEl.style.flex = `0 0 ${newP2}px`;
                }
            }
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                divider.classList.remove('dragging');
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        });
    });
}

// Setup Tab Drag Events (for dragging and reordering tabs like in a browser)
function attachTabDragEvents(tabEl, docId, paneIdx) {
    tabEl.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('application/json', JSON.stringify({
            tabId: docId,
            sourcePaneId: paneIdx
        }));
        e.dataTransfer.effectAllowed = 'move';
        tabEl.classList.add('dragging');
    });

    tabEl.addEventListener('dragend', () => {
        tabEl.classList.remove('dragging');
        document.querySelectorAll('.pane-tab').forEach(t => {
            t.classList.remove('drop-target-left', 'drop-target-right');
        });
        for (let i = 0; i < MAX_PANES; i++) {
            if (panes[i].dropOverlayEl) {
                const overlay = panes[i].dropOverlayEl;
                overlay.classList.remove('drag-over', 'split-mode');
                overlay.style.left = '0';
                overlay.style.width = '100%';
                overlay.style.right = '0';
                const badge = overlay.querySelector('span');
                if (badge) badge.textContent = 'タブを移動 (Drop to move)';
            }
        }
    });

    tabEl.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';

        const rect = tabEl.getBoundingClientRect();
        const isLeftHalf = (e.clientX - rect.left) < (rect.width / 2);

        if (isLeftHalf) {
            tabEl.classList.add('drop-target-left');
            tabEl.classList.remove('drop-target-right');
        } else {
            tabEl.classList.add('drop-target-right');
            tabEl.classList.remove('drop-target-left');
        }
    });

    tabEl.addEventListener('dragleave', () => {
        tabEl.classList.remove('drop-target-left', 'drop-target-right');
    });

    tabEl.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        tabEl.classList.remove('drop-target-left', 'drop-target-right');

        try {
            const data = JSON.parse(e.dataTransfer.getData('application/json'));
            const { tabId: draggedTabId, sourcePaneId } = data;
            const srcPaneIdx = parseInt(sourcePaneId, 10);
            const targetPaneIdx = paneIdx;

            const rect = tabEl.getBoundingClientRect();
            const isLeftHalf = (e.clientX - rect.left) < (rect.width / 2);

            const srcPane = panes[srcPaneIdx];
            const targetPane = panes[targetPaneIdx];

            // If dropped on itself in the same pane, do nothing
            if (srcPaneIdx === targetPaneIdx && draggedTabId === docId) {
                return;
            }

            // 1. Remove dragged tab from source pane
            const srcIdx = srcPane.tabs.indexOf(draggedTabId);
            if (srcIdx !== -1) {
                srcPane.tabs.splice(srcIdx, 1);
                if (srcPane.activeTabId === draggedTabId && srcPane.tabs.length > 0) {
                    srcPane.activeTabId = srcPane.tabs[Math.max(0, srcIdx - 1)];
                } else if (srcPane.tabs.length === 0) {
                    srcPane.activeTabId = null;
                }
            }

            // 2. Find target tab position in target pane and insert
            let targetIdx = targetPane.tabs.indexOf(docId);
            if (targetIdx !== -1) {
                const insertIdx = isLeftHalf ? targetIdx : targetIdx + 1;
                targetPane.tabs.splice(insertIdx, 0, draggedTabId);
            } else {
                targetPane.tabs.push(draggedTabId);
            }
            targetPane.activeTabId = draggedTabId;

            // 3. Auto-clean empty panes and re-render
            checkEmptyPanes();
            const finalPaneIdx = panes.findIndex(p => p.tabs.includes(draggedTabId));
            if (finalPaneIdx !== -1) {
                setActivePane(finalPaneIdx);
                focusActiveCellIfEditing(finalPaneIdx);
            }
        } catch (err) {
            console.error('Tab drop error:', err);
        }
    });
}

// Setup Tabs List Drop Events (for dropping into empty space of the tab bar)
function setupTabsListDropEvents(paneIdx) {
    const pane = panes[paneIdx];
    const tabsListEl = pane.tabsListEl;

    tabsListEl.addEventListener('dragover', (e) => {
        for (let i = 0; i < MAX_PANES; i++) {
            if (panes[i].dropOverlayEl) {
                const overlay = panes[i].dropOverlayEl;
                overlay.classList.remove('drag-over', 'split-mode');
                overlay.style.left = '0';
                overlay.style.width = '100%';
                overlay.style.right = '0';
            }
        }
        if (!e.target.closest('.pane-tab')) {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';
        }
    });

    tabsListEl.addEventListener('drop', (e) => {
        if (e.target.closest('.pane-tab')) return;
        e.preventDefault();
        e.stopPropagation();

        try {
            const data = JSON.parse(e.dataTransfer.getData('application/json'));
            const { tabId: draggedTabId, sourcePaneId } = data;
            const srcPaneIdx = parseInt(sourcePaneId, 10);
            const targetPaneIdx = paneIdx;

            const srcPane = panes[srcPaneIdx];
            const targetPane = panes[targetPaneIdx];

            // Remove from source
            const srcIdx = srcPane.tabs.indexOf(draggedTabId);
            if (srcIdx !== -1) {
                srcPane.tabs.splice(srcIdx, 1);
                if (srcPane.activeTabId === draggedTabId && srcPane.tabs.length > 0) {
                    srcPane.activeTabId = srcPane.tabs[Math.max(0, srcIdx - 1)];
                } else if (srcPane.tabs.length === 0) {
                    srcPane.activeTabId = null;
                }
            }

            // Append to target
            targetPane.tabs.push(draggedTabId);
            targetPane.activeTabId = draggedTabId;

            checkEmptyPanes();
            const finalPaneIdx = panes.findIndex(p => p.tabs.includes(draggedTabId));
            if (finalPaneIdx !== -1) {
                setActivePane(finalPaneIdx);
                focusActiveCellIfEditing(finalPaneIdx);
            }
        } catch (err) {
            console.error('Tabs list drop error:', err);
        }
    });
}

// Setup Pane Drop Events (for tab reordering, cross-pane moving, or splitting)
function setupPaneDropEvents(paneIdx) {
    const pane = panes[paneIdx];
    const container = pane.containerEl;
    const overlay = pane.dropOverlayEl;

    function resetOverlay() {
        overlay.classList.remove('drag-over', 'split-mode');
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.right = '0';
        const badge = overlay.querySelector('span');
        if (badge) badge.textContent = 'タブを移動 (Drop to move)';
    }

    container.addEventListener('dragover', (e) => {
        if (e.target.closest('.pane-tab-bar')) {
            resetOverlay();
            return;
        }

        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        overlay.classList.add('drag-over');

        const rect = container.getBoundingClientRect();
        const dropX = e.clientX - rect.left;
        const isRightHalf = dropX > (rect.width * 0.5);
        const canSplit = openPaneCount < MAX_PANES;
        const badge = overlay.querySelector('span');

        if (isRightHalf && canSplit) {
            overlay.classList.add('split-mode');
            overlay.style.left = '50%';
            overlay.style.width = '50%';
            overlay.style.right = '0';
            if (badge) badge.textContent = 'ペインを分割 (Drop to split)';
        } else {
            overlay.classList.remove('split-mode');
            overlay.style.left = '0';
            overlay.style.width = '100%';
            overlay.style.right = '0';
            if (badge) badge.textContent = 'タブを移動 (Drop to move)';
        }
    });

    container.addEventListener('dragleave', (e) => {
        if (!container.contains(e.relatedTarget)) {
            resetOverlay();
        }
    });

    container.addEventListener('drop', (e) => {
        if (e.target.closest('.pane-tab-bar')) {
            return;
        }

        e.preventDefault();
        resetOverlay();

        try {
            const data = JSON.parse(e.dataTransfer.getData('application/json'));
            const { tabId, sourcePaneId } = data;
            const srcIdx = parseInt(sourcePaneId, 10);

            const rect = container.getBoundingClientRect();
            const dropX = e.clientX - rect.left;
            const isRightHalf = dropX > (rect.width * 0.5);
            const canSplit = openPaneCount < MAX_PANES;

            if (isRightHalf && canSplit) {
                splitPaneAt(paneIdx, tabId, srcIdx);
                return;
            }

            if (srcIdx !== paneIdx) {
                const srcPane = panes[srcIdx];
                const tabPos = srcPane.tabs.indexOf(tabId);
                if (tabPos !== -1) {
                    srcPane.tabs.splice(tabPos, 1);
                    if (srcPane.tabs.length > 0) {
                        if (srcPane.activeTabId === tabId) {
                            srcPane.activeTabId = srcPane.tabs[Math.max(0, tabPos - 1)] || null;
                        }
                    } else {
                        srcPane.activeTabId = null;
                    }
                }

                if (!pane.tabs.includes(tabId)) {
                    pane.tabs.push(tabId);
                }
                pane.activeTabId = tabId;

                checkEmptyPanes();
                const finalPaneIdx = panes.findIndex(p => p.tabs.includes(tabId));
                if (finalPaneIdx !== -1) {
                    setActivePane(finalPaneIdx);
                    focusActiveCellIfEditing(finalPaneIdx);
                }
            }
        } catch (err) {
            console.error('Drop error:', err);
        }
    });
}

// Check Unsaved Changes
function checkUnsavedChangesForDoc(doc, onConfirm) {
    if (!doc.isModified) {
        onConfirm();
        return;
    }
    pendingAction = onConfirm;
    document.getElementById('unsaved-notebook-name').textContent = doc.filename;
    document.getElementById('unsaved-modal').classList.remove('hidden');
}

// Delete File
async function deleteFileByName(filename) {
    if (!filename) return;
    let targetFile = filename;

    let fullRel = targetFile;
    if (currentBrowsePath && !targetFile.includes('/') && !targetFile.startsWith(currentBrowsePath)) {
        fullRel = `${currentBrowsePath}/${targetFile}`;
    } else if (currentBrowsePath && targetFile.startsWith(currentBrowsePath + '/')) {
        fullRel = targetFile;
    }

    const displayName = targetFile.includes('/') ? targetFile.split('/').pop() : targetFile;
    if (!confirm(`Are you sure you want to delete "${displayName}"? This action cannot be undone.`)) {
        return;
    }

    try {
        const response = await fetch(`/api/delete/${encodeURIComponent(fullRel).replace(/%2F/g, '/')}`, { method: 'DELETE' });
        if (response.ok) {
            const baseName = displayName.replace(/\.md$/, '');
            const toClose = [];
            for (const [docId, doc] of documents.entries()) {
                if (doc.relPath === fullRel || (doc.relPath === '' && (doc.filename === baseName || doc.filename === displayName))) {
                    toClose.push(docId);
                }
            }
            for (const docId of toClose) {
                for (let p = openPaneCount - 1; p >= 0; p--) {
                    performCloseTab(p, docId);
                }
            }
            await loadFileList();
        } else {
            const data = await response.json();
            alert('Failed to delete file: ' + (data.detail || 'Unknown error'));
        }
    } catch (err) {
        console.error('Delete error:', err);
        alert('Error deleting file: ' + err.message);
    }
}

// Delete Folder (Option A: Recursive deletion with confirmation)
async function deleteFolderByName(folderName) {
    if (!folderName) return;

    let fullRel = folderName;
    if (currentBrowsePath && !folderName.includes('/') && !folderName.startsWith(currentBrowsePath)) {
        fullRel = `${currentBrowsePath}/${folderName}`;
    } else if (currentBrowsePath && folderName.startsWith(currentBrowsePath + '/')) {
        fullRel = folderName;
    }

    const displayName = folderName.includes('/') ? folderName.split('/').pop() : folderName;
    if (!confirm(`Are you sure you want to delete folder "${displayName}" and all its contents? This action cannot be undone.`)) {
        return;
    }

    try {
        const response = await fetch(`/api/delete/${encodeURIComponent(fullRel).replace(/%2F/g, '/')}?is_dir=true`, { method: 'DELETE' });
        if (response.ok) {
            // Close any open tabs that were inside this folder
            const toClose = [];
            for (const [docId, doc] of documents.entries()) {
                if (doc.relPath && (doc.relPath === fullRel || doc.relPath.startsWith(fullRel + '/'))) {
                    toClose.push(docId);
                }
            }
            for (const docId of toClose) {
                for (let p = openPaneCount - 1; p >= 0; p--) {
                    performCloseTab(p, docId);
                }
            }

            // If user was browsing inside deleted folder or its children, return to parent or root
            if (currentBrowsePath === fullRel || currentBrowsePath.startsWith(fullRel + '/')) {
                const parentPath = fullRel.includes('/') ? fullRel.substring(0, fullRel.lastIndexOf('/')) : '';
                currentBrowsePath = parentPath;
            }

            await loadFileList();
        } else {
            const data = await response.json();
            alert('Failed to delete folder: ' + (data.detail || 'Unknown error'));
        }
    } catch (err) {
        console.error('Delete folder error:', err);
        alert('Error deleting folder: ' + err.message);
    }
}

async function deleteCurrentFile() {
    const doc = getActiveDocument();
    if (!doc) {
        alert("No file is currently open.");
        return;
    }
    const isNotebook = !doc.fileType || doc.fileType === 'notebook';
    const target = doc.relPath || (isNotebook ? (doc.dirPath ? `${doc.dirPath}/${doc.filename}.md` : `${doc.filename}.md`) : doc.filename);
    await deleteFileByName(target);
}

// Rename helpers
async function renameOnServer(oldPath, newPath, isFolder = false, suppressAlert = false) {
    try {
        const response = await fetch('/api/rename', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                old_path: oldPath,
                new_path: newPath,
                is_folder: isFolder
            })
        });
        const data = await response.json();
        if (response.ok) {
            return { success: true, message: data.message };
        } else {
            if (!suppressAlert && data.detail !== 'Source not found') {
                alert('Failed to rename: ' + (data.detail || 'Unknown error'));
            }
            return { success: false, error: data.detail };
        }
    } catch (err) {
        console.error('Rename error:', err);
        if (!suppressAlert) {
            alert('Error renaming: ' + err.message);
        }
        return { success: false, error: err.message };
    }
}

async function renameFileOnServer(oldFilename, newFilename) {
    return await renameOnServer(oldFilename, newFilename, false);
}

function updateDocumentFilename(oldBaseName, newBaseName, oldRel = '', newRel = '', targetDocId = null) {
    for (const [docId, doc] of documents.entries()) {
        const matchesTarget = targetDocId && docId === targetDocId;
        const matchesRelPath = !targetDocId && oldRel && doc.relPath === oldRel;
        const matchesFallback = !targetDocId && !oldRel && !doc.relPath && doc.filename === oldBaseName;

        if (matchesTarget || matchesRelPath || matchesFallback) {
            doc.filename = newBaseName;
            if (newRel) {
                doc.relPath = newRel;
                doc.dirPath = newRel.includes('/') ? newRel.substring(0, newRel.lastIndexOf('/')) : '';
            }
            if (matchesTarget) break;
        }
    }
    for (let p = 0; p < openPaneCount; p++) {
        renderTabs(p);
        const pDoc = getPaneActiveDocument(p);
        if (pDoc) {
            panes[p].nameInputEl.value = pDoc.filename;
            panes[p].nameInputEl.defaultValue = pDoc.filename;
            panes[p].nameInputEl.dataset.isEditing = 'false';
        }
    }
}

function startInlineRename(targetFile) {
    if (cellStateBeforeRename === null) {
        saveCellStateBeforeRename();
    }
    isInlineRenaming = true;

    // Find the file element in fileListContainer
    const fileEls = fileListContainer.querySelectorAll('[data-file]');
    let targetEl = null;
    for (const el of fileEls) {
        if (el.getAttribute('data-file') === targetFile) {
            targetEl = el;
            break;
        }
    }

    if (!targetEl) {
        restoreCellStateAfterRename();
        return;
    }

    const lastDotIndex = targetFile.lastIndexOf('.');
    let currentBaseName = targetFile;
    let ext = '';
    if (lastDotIndex > 0) {
        currentBaseName = targetFile.substring(0, lastDotIndex);
        ext = targetFile.substring(lastDotIndex);
    }

    targetEl.innerHTML = '';
    targetEl.className = 'flex items-center px-2 py-1 bg-white border border-blue-400 rounded space-x-1.5 text-gray-700 shadow-sm';

    const icon = document.createElement('i');
    icon.className = `${getFileIconClass(targetFile)} flex-shrink-0 text-xs`;

    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentBaseName;
    input.className = 'rename-file-input flex-1 px-1 py-0.5 text-xs text-gray-800 border border-gray-300 rounded focus:border-blue-500 focus:outline-none min-w-0';

    const extSpan = document.createElement('span');
    extSpan.className = 'text-xs text-gray-400 flex-shrink-0 select-none font-mono';
    extSpan.textContent = ext;

    targetEl.appendChild(icon);
    targetEl.appendChild(input);
    if (ext) {
        targetEl.appendChild(extSpan);
    }

    let isCommitted = false;

    async function commit() {
        if (isCommitted) return;
        isCommitted = true;

        let newName = input.value.trim();
        if (ext && newName.endsWith(ext)) {
            newName = newName.slice(0, -ext.length).trim();
        }

        if (!newName) {
            alert('Filename cannot be empty.');
            await loadFileList();
            restoreCellStateAfterRename();
            return;
        }

        if (newName !== currentBaseName) {
            const oldWithExt = targetFile;
            const newWithExt = ext ? newName + ext : newName;
            const oldRel = currentBrowsePath ? `${currentBrowsePath}/${oldWithExt}` : oldWithExt;
            const newRel = currentBrowsePath ? `${currentBrowsePath}/${newWithExt}` : newWithExt;
            const result = await renameOnServer(oldRel, newRel, false);
            if (result.success) {
                updateDocumentFilename(currentBaseName, newName, oldRel, newRel);
                for (const [docId, doc] of documents.entries()) {
                    if (doc.filename === oldWithExt) {
                        doc.filename = newWithExt;
                    }
                }
            }
        }

        await loadFileList();
        restoreCellStateAfterRename();
    }

    function cancel() {
        if (isCommitted) return;
        isCommitted = true;
        loadFileList();
        restoreCellStateAfterRename();
    }

    input.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            await commit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            cancel();
        }
    });

    input.addEventListener('blur', () => {
        setTimeout(() => {
            if (!isCommitted) {
                cancel();
            }
        }, 150);
    });

    input.addEventListener('click', (e) => e.stopPropagation());
    input.addEventListener('dblclick', (e) => e.stopPropagation());

    setTimeout(() => {
        input.focus();
        input.select();
    }, 50);
}

// Inline Rename Folder (Option A)
function startInlineRenameFolder(targetFolder) {
    if (cellStateBeforeRename === null) {
        saveCellStateBeforeRename();
    }
    isInlineRenaming = true;

    // Find the folder element in fileListContainer
    const folderEls = fileListContainer.querySelectorAll('[data-folder]');
    let targetEl = null;
    for (const el of folderEls) {
        if (el.getAttribute('data-folder') === targetFolder) {
            targetEl = el;
            break;
        }
    }

    if (!targetEl) {
        restoreCellStateAfterRename();
        return;
    }

    targetEl.innerHTML = '';
    targetEl.className = 'flex items-center px-2 py-1 bg-white border border-blue-400 rounded space-x-1.5 text-gray-700 shadow-sm';

    const icon = document.createElement('i');
    icon.className = 'fa-solid fa-folder text-blue-500 flex-shrink-0 text-xs';

    const input = document.createElement('input');
    input.type = 'text';
    input.value = targetFolder;
    input.className = 'rename-file-input flex-1 px-1 py-0.5 text-xs text-gray-800 border border-gray-300 rounded focus:border-blue-500 focus:outline-none min-w-0';

    targetEl.appendChild(icon);
    targetEl.appendChild(input);

    let isCommitted = false;

    async function commit() {
        if (isCommitted) return;
        isCommitted = true;

        let newName = input.value.trim();
        newName = newName.replace(/[\/\\]+$/, '').trim();

        if (!newName) {
            alert('Folder name cannot be empty.');
            await loadFileList();
            restoreCellStateAfterRename();
            return;
        }

        if (newName !== targetFolder) {
            const oldRel = currentBrowsePath ? `${currentBrowsePath}/${targetFolder}` : targetFolder;
            const newRel = currentBrowsePath ? `${currentBrowsePath}/${newName}` : newName;
            const result = await renameOnServer(oldRel, newRel, true);
            if (result.success) {
                // Update documents that were inside oldRel
                for (const [docId, doc] of documents.entries()) {
                    if (doc.relPath && (doc.relPath === oldRel || doc.relPath.startsWith(oldRel + '/'))) {
                        doc.relPath = newRel + doc.relPath.slice(oldRel.length);
                        if (doc.dirPath === oldRel) {
                            doc.dirPath = newRel;
                        } else if (doc.dirPath && doc.dirPath.startsWith(oldRel + '/')) {
                            doc.dirPath = newRel + doc.dirPath.slice(oldRel.length);
                        }
                    }
                }
            }
        }

        await loadFileList();
        restoreCellStateAfterRename();
    }

    function cancel() {
        if (isCommitted) return;
        isCommitted = true;
        loadFileList();
        restoreCellStateAfterRename();
    }

    input.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            await commit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            cancel();
        }
    });

    input.addEventListener('blur', () => {
        setTimeout(() => {
            if (!isCommitted) {
                cancel();
            }
        }, 150);
    });

    input.addEventListener('click', (e) => e.stopPropagation());
    input.addEventListener('dblclick', (e) => e.stopPropagation());

    setTimeout(() => {
        input.focus();
        input.select();
    }, 50);
}

// Drag and Drop Upload for File List (JupyterLab style)
function setupFileListDragAndDrop() {
    if (!fileListContainer) return;
    const fileDropOverlay = document.getElementById('file-drop-overlay');
    const dropArea = fileListContainer.parentElement || fileListContainer;

    // Prevent default browser file open when dropping outside dropArea
    window.addEventListener('dragover', (e) => {
        if (e.dataTransfer && e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
            e.preventDefault();
        }
    });

    window.addEventListener('drop', (e) => {
        if (e.dataTransfer && e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
            if (!dropArea.contains(e.target)) {
                e.preventDefault();
            }
        }
    });

    function isOsFileDrag(e) {
        if (!e.dataTransfer || !e.dataTransfer.types) return false;
        const types = Array.from(e.dataTransfer.types);
        return types.includes('Files') && !types.includes('application/x-app-file');
    }

    let dragCounter = 0;

    dropArea.addEventListener('dragenter', (e) => {
        if (isOsFileDrag(e)) {
            e.preventDefault();
            dragCounter++;
            if (fileDropOverlay) fileDropOverlay.classList.remove('hidden');
        }
    });

    dropArea.addEventListener('dragover', (e) => {
        if (isOsFileDrag(e)) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        }
    });

    dropArea.addEventListener('dragleave', (e) => {
        if (isOsFileDrag(e)) {
            e.preventDefault();
            dragCounter--;
            if (dragCounter <= 0) {
                dragCounter = 0;
                if (fileDropOverlay) fileDropOverlay.classList.add('hidden');
            }
        }
    });

    dropArea.addEventListener('drop', async (e) => {
        if (isOsFileDrag(e)) {
            e.preventDefault();
            e.stopPropagation();
            dragCounter = 0;
            if (fileDropOverlay) fileDropOverlay.classList.add('hidden');

            const files = Array.from(e.dataTransfer.files || []);
            if (files.length === 0) return;

            const targetDir = currentBrowsePath;
            let successCount = 0;
            let failCount = 0;

            for (const file of files) {
                try {
                    const uploadUrl = `/api/upload-file?path=${encodeURIComponent(targetDir)}&filename=${encodeURIComponent(file.name)}`;
                    const response = await fetch(uploadUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': file.type || 'application/octet-stream'
                        },
                        body: file
                    });
                    if (response.ok) {
                        successCount++;
                    } else {
                        const errData = await response.json().catch(() => ({}));
                        console.error(`Failed to upload ${file.name}:`, errData.detail);
                        failCount++;
                    }
                } catch (err) {
                    console.error(`Error uploading ${file.name}:`, err);
                    failCount++;
                }
            }

            await loadFileList();

            if (failCount > 0) {
                alert(`Uploaded ${successCount} file(s). Failed to upload ${failCount} file(s).`);
            }
        }
    });
}

// Global Event Listeners
function setupEventListeners() {
    setupFileListDragAndDrop();
    refreshFilesBtn.addEventListener('click', loadFileList);

    if (btnNewFile) {
        btnNewFile.addEventListener('click', (e) => {
            e.preventDefault();
            handleNewFileBtn();
        });
    }

    if (btnNewFolder) {
        btnNewFolder.addEventListener('click', (e) => {
            e.preventDefault();
            handleNewFolderBtn();
        });
    }


    menuNewNotebook.addEventListener('click', (e) => {
        e.preventDefault();
        createNewNotebook();
    });
    emptyNewBtn.addEventListener('click', createNewNotebook);

    if (menuSaveNotebook) {
        menuSaveNotebook.addEventListener('click', (e) => {
            e.preventDefault();
        });
    }

    if (menuExportMarkdown) {
        menuExportMarkdown.addEventListener('click', async (e) => {
            e.preventDefault();
            await exportMarkdown();
        });
    }

    if (menuExportPdf) {
        menuExportPdf.addEventListener('click', async (e) => {
            e.preventDefault();
            await exportPdf();
        });
    }

    if (menuExportHtml) {
        menuExportHtml.addEventListener('click', async (e) => {
            e.preventDefault();
            await exportHtml();
        });
    }

    menuSaveFile.addEventListener('click', (e) => {
        e.preventDefault();
        saveNotebook();
    });

    menuSaveFileAs.addEventListener('click', (e) => {
        e.preventDefault();
        saveNotebookAs();
    });

    if (menuSplitEditor) {
        menuSplitEditor.addEventListener('click', (e) => {
            e.preventDefault();
            splitPaneVertically();
        });
    }

    menuDeleteFile.addEventListener('click', (e) => {
        e.preventDefault();
        deleteCurrentFile();
    });

    // Cell Operations via menu
    menuCopyCell.addEventListener('click', (e) => {
        e.preventDefault();
        const doc = getActiveDocument();
        if (doc && doc.activeIndex !== -1) copyCell(doc.activeIndex);
    });

    menuCutCell.addEventListener('click', (e) => {
        e.preventDefault();
        const doc = getActiveDocument();
        if (doc && doc.activeIndex !== -1) cutCell(doc.activeIndex);
    });

    menuPasteCellBelow.addEventListener('click', (e) => {
        e.preventDefault();
        const doc = getActiveDocument();
        if (doc && doc.activeIndex !== -1) pasteCell(doc.activeIndex, 'below');
    });

    menuPasteCellAbove.addEventListener('click', (e) => {
        e.preventDefault();
        const doc = getActiveDocument();
        if (doc && doc.activeIndex !== -1) pasteCell(doc.activeIndex, 'above');
    });



    menuMergeSelectedCells.addEventListener('click', (e) => {
        e.preventDefault();
        mergeSelectedCells();
    });

    menuUndoCell.addEventListener('click', (e) => {
        e.preventDefault();
        undoCellOperation();
    });

    menuRedoCell.addEventListener('click', (e) => {
        e.preventDefault();
        redoCellOperation();
    });

    menuSelectAllCells.addEventListener('click', (e) => {
        e.preventDefault();
        selectAllCells();
    });

    menuDeleteCell.addEventListener('click', (e) => {
        e.preventDefault();
        const doc = getActiveDocument();
        if (doc && doc.activeIndex !== -1) deleteCell(doc.activeIndex);
    });

    menuSplitCell.addEventListener('click', (e) => {
        e.preventDefault();
        const doc = getActiveDocument();
        if (doc && doc.activeIndex !== -1) splitCell(doc.activeIndex);
    });

    menuRecenterLine.addEventListener('click', (e) => {
        e.preventDefault();
        const doc = getActiveDocument();
        if (!doc) return;
        const activeEl = document.activeElement;
        const isEditingText = activeEl && activeEl.tagName === 'TEXTAREA';
        if (isEditingText && activeEl.id.startsWith('textarea-')) {
            recenterCaretLine(activeEl);
        } else if (doc.globalMode === 'edit' && doc.activeIndex !== -1) {
            const textarea = document.getElementById(`textarea-${doc.cells[doc.activeIndex].id}`);
            if (textarea) {
                recenterCaretLine(textarea);
            } else {
                recenterActiveCellTop();
            }
        } else if (doc.activeIndex !== -1) {
            recenterActiveCellTop();
        }
    });

    btnToggleSidebar.addEventListener('click', toggleFileBrowser);
    if (btnToggleToc) btnToggleToc.addEventListener('click', () => toggleToc());
    if (refreshTocBtn) refreshTocBtn.addEventListener('click', () => renderToc());
    if (closeTocBtn) closeTocBtn.addEventListener('click', () => toggleToc(false));

    // Shortcuts modal
    menuShortcuts.addEventListener('click', (e) => {
        e.preventDefault();
        shortcutsModal.classList.remove('hidden');
    });
    const hideModal = () => shortcutsModal.classList.add('hidden');
    closeModalBtn.addEventListener('click', hideModal);
    closeModalFooterBtn.addEventListener('click', hideModal);

    // Unsaved Changes Modal
    document.getElementById('unsaved-cancel-btn').addEventListener('click', () => {
        document.getElementById('unsaved-modal').classList.add('hidden');
        pendingAction = null;
    });

    document.getElementById('unsaved-dont-save-btn').addEventListener('click', () => {
        document.getElementById('unsaved-modal').classList.add('hidden');
        const action = pendingAction;
        pendingAction = null;
        if (action) {
            const doc = getActiveDocument();
            if (doc) doc.isModified = false;
            action();
        }
    });

    document.getElementById('unsaved-save-btn').addEventListener('click', async () => {
        document.getElementById('unsaved-modal').classList.add('hidden');
        const doc = getActiveDocument();
        const success = await saveNotebook(doc);
        if (success) {
            const action = pendingAction;
            pendingAction = null;
            if (action) action();
        } else {
            document.getElementById('unsaved-modal').classList.remove('hidden');
        }
    });

    // Context menu click-outside
    document.addEventListener('click', (e) => {
        if (!fileContextMenu.contains(e.target)) {
            fileContextMenu.classList.add('hidden');
            if (!isInlineRenaming) {
                cellStateBeforeRename = null;
            }
        }
    });

    if (contextCopyBtn) {
        contextCopyBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const targetName = fileContextMenu.getAttribute('data-target-name') || fileContextMenu.getAttribute('data-target-file');
            const isFolder = fileContextMenu.getAttribute('data-is-folder') === 'true';
            const relPath = fileContextMenu.getAttribute('data-rel-path') || (currentBrowsePath ? `${currentBrowsePath}/${targetName}` : targetName);
            fileContextMenu.classList.add('hidden');
            if (selectedBrowserItem && selectedBrowserItem.relPath === relPath) {
                copySelectedFile(selectedBrowserItem);
            } else if (targetName) {
                copySelectedFile({ name: targetName, isFolder, relPath, el: null });
            }
        });
    }

    if (contextCutBtn) {
        contextCutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const targetName = fileContextMenu.getAttribute('data-target-name') || fileContextMenu.getAttribute('data-target-file');
            const isFolder = fileContextMenu.getAttribute('data-is-folder') === 'true';
            const relPath = fileContextMenu.getAttribute('data-rel-path') || (currentBrowsePath ? `${currentBrowsePath}/${targetName}` : targetName);
            fileContextMenu.classList.add('hidden');
            if (selectedBrowserItem && selectedBrowserItem.relPath === relPath) {
                cutSelectedFile(selectedBrowserItem);
            } else if (targetName) {
                cutSelectedFile({ name: targetName, isFolder, relPath, el: null });
            }
        });
    }

    if (contextPasteBtn) {
        contextPasteBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const targetDir = fileContextMenu.getAttribute('data-paste-dir') !== null ? fileContextMenu.getAttribute('data-paste-dir') : currentBrowsePath;
            fileContextMenu.classList.add('hidden');
            await pasteFileToDirectory(targetDir);
        });
    }

    if (fileListContainer) {
        fileListContainer.addEventListener('contextmenu', (e) => {
            // If target was file/folder, its own handler stopped propagation
            e.preventDefault();
            e.stopPropagation();

            fileContextMenu.classList.remove('hidden');
            const listRect = fileListContainer.getBoundingClientRect();
            const threshold = listRect.bottom - (listRect.height / 3);
            if (e.clientY > threshold) {
                fileContextMenu.style.left = `${e.clientX + 5}px`;
                fileContextMenu.style.top = `${e.clientY - fileContextMenu.offsetHeight}px`;
            } else {
                fileContextMenu.style.left = `${e.clientX}px`;
                fileContextMenu.style.top = `${e.clientY}px`;
            }
            fileContextMenu.removeAttribute('data-target-name');
            fileContextMenu.removeAttribute('data-target-file');
            fileContextMenu.removeAttribute('data-is-folder');
            fileContextMenu.removeAttribute('data-rel-path');
            fileContextMenu.setAttribute('data-paste-dir', currentBrowsePath);

            if (contextCopyBtn) contextCopyBtn.classList.add('hidden');
            if (contextCutBtn) contextCutBtn.classList.add('hidden');
            if (contextDivider) contextDivider.classList.add('hidden');
            if (contextRenameBtn) contextRenameBtn.classList.add('hidden');
            if (contextDeleteBtn) contextDeleteBtn.classList.add('hidden');

            if (contextPasteBtn) {
                contextPasteBtn.classList.remove('hidden');
                if (fileClipboard && fileClipboard.sourceRelPath) {
                    contextPasteBtn.classList.remove('opacity-50', 'pointer-events-none');
                    contextPasteBtn.removeAttribute('disabled');
                } else {
                    contextPasteBtn.classList.add('opacity-50', 'pointer-events-none');
                    contextPasteBtn.setAttribute('disabled', 'true');
                }
            }
        });

        fileListContainer.addEventListener('click', (e) => {
            if (e.target === fileListContainer) {
                clearBrowserSelection();
            }
        });
    }

    if (contextRenameBtn) {
        contextRenameBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const targetName = fileContextMenu.getAttribute('data-target-name') || fileContextMenu.getAttribute('data-target-file');
            const isFolder = fileContextMenu.getAttribute('data-is-folder') === 'true';
            fileContextMenu.classList.add('hidden');
            if (targetName) {
                if (isFolder) {
                    startInlineRenameFolder(targetName);
                } else {
                    startInlineRename(targetName);
                }
            }
        });
    }

    if (contextDeleteBtn) {
        contextDeleteBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            cellStateBeforeRename = null;
            const targetName = fileContextMenu.getAttribute('data-target-name') || fileContextMenu.getAttribute('data-target-file');
            const isFolder = fileContextMenu.getAttribute('data-is-folder') === 'true';
            fileContextMenu.classList.add('hidden');
            if (targetName) {
                if (isFolder) {
                    await deleteFolderByName(targetName);
                } else {
                    await deleteFileByName(targetName);
                }
            }
        });
    }

    // Track Control key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Control') isCtrlPressed = true;
    });
    document.addEventListener('keyup', (e) => {
        if (e.key === 'Control') isCtrlPressed = false;
    });
    window.addEventListener('blur', () => {
        isCtrlPressed = false;
    });

    // Window resize: update dummy cells height and scrollbar markers
    window.addEventListener('resize', () => {
        updateDummyCellsHeight();
        for (let p = 0; p < openPaneCount; p++) {
            updatePaneScrollMarkers(p);
            const doc = getPaneActiveDocument(p);
            if (doc) {
                doc.cells.forEach(c => {
                    if (c.mode === 'edit') {
                        const ta = document.getElementById(`textarea-${c.id}`);
                        if (ta) {
                            autoResizeTextarea(ta, p);
                            updateLineNumbers(ta, c.id);
                            updateCellCaretAndHighlight(ta, c.id);
                        }
                    }
                });
            }
        }
    });

    // Global selectionchange to update block cursor & line highlight
    document.addEventListener('selectionchange', () => {
        const activeEl = document.activeElement;
        if (activeEl && activeEl.tagName === 'TEXTAREA' && activeEl.id && activeEl.id.startsWith('textarea-')) {
            updateCellCaretAndHighlight(activeEl);
        }
    });

    // Keyboard Shortcuts Manager (Global)
    document.addEventListener('keydown', handleGlobalKeydown);

    // Warn on browser close if any document modified
    window.addEventListener('beforeunload', (e) => {
        const anyModified = Array.from(documents.values()).some(d => d.isModified);
        if (anyModified) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
}

// Global Keydown Handler
function handleGlobalKeydown(e) {
    if (activePromptState && activePromptState.step === 'confirm') {
        if (handleReplaceConfirmKey(e, activePromptState.paneIdx)) return;
    }
    if (activePromptState && e.key === 'Escape') {
        e.preventDefault();
        closePromptBar(activePromptState.paneIdx);
        return;
    }

    const doc = getActiveDocument();
    const activeEl = document.activeElement;
    const isEditingText = activeEl && (activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'INPUT' || activeEl.isContentEditable);

    // File Browser Shortcuts: Ctrl + C (Copy), Ctrl + X (Cut), Ctrl + V (Paste)
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey) {
        const isKeyC = (e.key && e.key.toLowerCase() === 'c') || e.code === 'KeyC';
        const isKeyX = (e.key && e.key.toLowerCase() === 'x') || e.code === 'KeyX';
        const isKeyV = (e.key && e.key.toLowerCase() === 'v') || e.code === 'KeyV';

        if (isKeyC || isKeyX || isKeyV) {
            // [回避策・共存対策 1] セル編集モード・入力欄（textarea, input, contenteditable）でのテキスト編集を最優先
            // テキスト入力中はブラウザ標準のテキストコピー、カット、貼り付け（Ctrl+V）を妨げないよう早期リターン
            if (isEditingText) {
                return;
            }

            // [回避策・共存対策 2] コマンドモード／非入力時のみファイル操作ショートカットを実行
            // (コマンドモードのセル貼り付けは単体キー「v」「Shift+v」のため、Ctrl+Vとの衝突はありません)
            if (isKeyV) {
                if (fileClipboard && fileClipboard.sourceRelPath) {
                    e.preventDefault();
                    e.stopPropagation();
                    pasteFileToDirectory(currentBrowsePath);
                    return;
                }
            }

            if (isKeyC) {
                const hasTextSelection = window.getSelection() && window.getSelection().toString().length > 0;
                if (!hasTextSelection && selectedBrowserItem) {
                    e.preventDefault();
                    e.stopPropagation();
                    copySelectedFile();
                    return;
                }
            }

            if (isKeyX) {
                if (selectedBrowserItem) {
                    e.preventDefault();
                    e.stopPropagation();
                    cutSelectedFile();
                    return;
                }
            }
        }
    }

    // Ctrl + H : In-Cell String Replacement (Edit Mode)
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'h') {
        if (isEditingText || (doc && doc.globalMode === 'edit')) {
            e.preventDefault();
            e.stopPropagation();
            openReplacePrompt(activePaneIndex);
            return;
        }
    }

    // Ctrl + G : In-Cell Go to Line (Edit Mode)
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'g') {
        if (isEditingText || (doc && doc.globalMode === 'edit')) {
            e.preventDefault();
            e.stopPropagation();
            openGoToLinePrompt(activePaneIndex);
            return;
        }
    }

    // 1. Check Split Editor Shortcut (Ctrl+\)
    // Ctrl + \ : Split Editor Vertically
    if (e.ctrlKey && (e.key === '\\' || e.code === 'Backslash')) {
        e.preventDefault();
        splitPaneVertically();
        return;
    }

    // Ctrl + Alt + W : Close active tab in current pane
    if (e.ctrlKey && e.altKey && !e.shiftKey && !e.metaKey && (e.key.toLowerCase() === 'w' || e.code === 'KeyW')) {
        const pane = getActivePane();
        if (pane && pane.activeTabId) {
            e.preventDefault();
            closeTab(activePaneIndex, pane.activeTabId);
            return;
        }
    }

    // Ctrl + Alt + M : Merge active pane into adjacent left pane
    if (e.ctrlKey && e.altKey && !e.shiftKey && !e.metaKey && (e.key.toLowerCase() === 'm' || e.code === 'KeyM')) {
        e.preventDefault();
        mergeLastPane();
        return;
    }

    // Ctrl + Shift + F : Toggle File Browser Sidebar
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && (e.key.toLowerCase() === 'f' || e.code === 'KeyF')) {
        e.preventDefault();
        toggleFileBrowser();
        return;
    }

    // Ctrl + Alt + F : Toggle Table of Contents (ToC)
    if (e.ctrlKey && e.altKey && !e.shiftKey && !e.metaKey && (e.key.toLowerCase() === 'f' || e.code === 'KeyF')) {
        e.preventDefault();
        toggleToc();
        return;
    }

    // Ctrl + Shift + Q : Quit Application
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && (e.key.toLowerCase() === 'q' || e.code === 'KeyQ')) {
        e.preventDefault();
        e.stopPropagation();
        executeQuit();
        return;
    }

    // Ctrl + Shift + Left / H : Switch to previous (left) tab in active pane
    if (e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey && (e.key === 'ArrowLeft' || e.key === 'Left' || e.key.toLowerCase() === 'h')) {
        const pane = getActivePane();
        if (pane && pane.tabs && pane.tabs.length > 1) {
            e.preventDefault();
            switchTabInActivePane('left');
            return;
        } else if (!isEditingText || e.key.toLowerCase() === 'h') {
            e.preventDefault();
            return;
        }
    }

    // Ctrl + Shift + Right / L : Switch to next (right) tab in active pane
    if (e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey && (e.key === 'ArrowRight' || e.key === 'Right' || e.key.toLowerCase() === 'l')) {
        const pane = getActivePane();
        if (pane && pane.tabs && pane.tabs.length > 1) {
            e.preventDefault();
            switchTabInActivePane('right');
            return;
        } else if (!isEditingText || e.key.toLowerCase() === 'l') {
            e.preventDefault();
            return;
        }
    }

    // Ctrl + Alt + - : Split Cell
    if (isMinusKeyEvent(e)) {
        if (isEditingText && activeEl && activeEl.id && activeEl.id.startsWith('textarea-')) {
            e.preventDefault();
            e.stopPropagation();
            const cellId = activeEl.id.replace('textarea-', '');
            const targetDoc = doc || getPaneActiveDocument(activePaneIndex);
            if (targetDoc) {
                const cellIdx = targetDoc.cells.findIndex(c => String(c.id) === String(cellId));
                if (cellIdx !== -1) {
                    splitCell(cellIdx, activePaneIndex);
                    return;
                }
            }
        } else if (doc && doc.activeIndex !== -1) {
            e.preventDefault();
            e.stopPropagation();
            splitCell(doc.activeIndex, activePaneIndex);
            return;
        }
    }

    // Ctrl + Alt + L : Recenter Caret Line / Cell Top
    if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        if (isEditingText && activeEl.id.startsWith('textarea-')) {
            recenterCaretLine(activeEl);
        } else if (doc && doc.globalMode === 'edit' && doc.activeIndex !== -1) {
            const textarea = document.getElementById(`textarea-${doc.cells[doc.activeIndex].id}`);
            if (textarea) {
                recenterCaretLine(textarea);
            } else {
                recenterActiveCellTop();
            }
        } else if (doc && doc.activeIndex !== -1) {
            recenterActiveCellTop();
        }
        return;
    }

    // Ctrl + N or Ctrl + Alt + N : New Notebook (New Tab)
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        createNewNotebook();
        return;
    }
    
    // Ctrl + Alt + S : Save File As
    if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveNotebookAs();
        return;
    }

    // Ctrl + S : Save File
    if (e.ctrlKey && !e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveNotebook();
        return;
    }

    // If editing text, do not process pane navigation or cell command mode shortcuts
    if (isEditingText) return;
    if (notebookContainer.classList.contains('hidden')) return;

    // Pane navigation: Left (ArrowLeft / Left, or h / H in Command Mode) and Right (ArrowRight / Right, or l / L in Command Mode)
    const isArrowLeft = (e.key === 'ArrowLeft' || e.key === 'Left') && !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey;
    const isArrowRight = (e.key === 'ArrowRight' || e.key === 'Right') && !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey;
    const isCommandMode = !doc || doc.globalMode === 'command';
    const isCmdH = isCommandMode && (e.key === 'h' || e.key === 'H') && !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey;
    const isCmdL = isCommandMode && (e.key === 'l' || e.key === 'L') && !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey;

    if (isArrowLeft || isCmdH) {
        if (openPaneCount > 1) {
            e.preventDefault();
            if (activePaneIndex > 0) {
                switchActivePane(activePaneIndex - 1);
            }
            return;
        }
    }

    if (isArrowRight || isCmdL) {
        if (openPaneCount > 1) {
            e.preventDefault();
            if (activePaneIndex < openPaneCount - 1) {
                switchActivePane(activePaneIndex + 1);
            }
            return;
        }
    }

    if (!doc || doc.cells.length === 0 || doc.activeIndex === -1) return;

    // 2. Command Mode Shortcuts
    if (doc.globalMode === 'command') {
        // Escape: cancel multiple cell selection and restore anchor cell single selection
        if (e.key === 'Escape' && !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
            if (doc.selectedIndices && doc.selectedIndices.length > 1) {
                e.preventDefault();
                e.stopPropagation();
                const anchorIdx = (doc.selectionAnchorIndex !== -1 && doc.selectionAnchorIndex < doc.cells.length)
                    ? doc.selectionAnchorIndex
                    : doc.activeIndex;
                selectCell(anchorIdx, false);
                return;
            }
        }

        // Move Cell (Ctrl + Shift + Up / Down)
        if (e.ctrlKey && e.shiftKey && (e.key === 'ArrowUp' || e.key === 'Up')) {
            e.preventDefault();
            moveCell(doc.activeIndex, 'up');
            return;
        }
        if (e.ctrlKey && e.shiftKey && (e.key === 'ArrowDown' || e.key === 'Down')) {
            e.preventDefault();
            moveCell(doc.activeIndex, 'down');
            return;
        }

        // Numeric prefix for Vim navigation
        if (/^[0-9]$/.test(e.key) && !e.ctrlKey && !e.altKey && !e.metaKey) {
            e.preventDefault();
            if (doc.numberBuffer === '' && e.key === '0') return;
            doc.numberBuffer += e.key;
            clearTimeout(numberBufferTimeout);
            numberBufferTimeout = setTimeout(() => {
                doc.numberBuffer = '';
            }, 2000);
            return;
        }

        if (e.key !== 'g' && e.key !== 'G') {
            doc.numberBuffer = '';
            clearTimeout(numberBufferTimeout);
        }

        // Cell navigation (Ctrl + up / down arrows, j / k)
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (e.key === 'ArrowDown' || e.key === 'Down')) {
            e.preventDefault();
            selectCell(doc.activeIndex + 1, false);
            return;
        }
        else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (e.key === 'ArrowUp' || e.key === 'Up')) {
            e.preventDefault();
            selectCell(doc.activeIndex - 1, false);
            return;
        }
        else if ((e.key === 'j' || e.key === 'J') && !e.ctrlKey && !e.altKey && !e.metaKey) {
            e.preventDefault();
            selectCell(doc.activeIndex + 1, e.shiftKey);
            return;
        }
        else if ((e.key === 'k' || e.key === 'K') && !e.ctrlKey && !e.altKey && !e.metaKey) {
            e.preventDefault();
            selectCell(doc.activeIndex - 1, e.shiftKey);
            return;
        }
        // Browser-style viewport scroll (ArrowDown / ArrowUp) - ページのコマ送り的上下
        else if (!e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey && (e.key === 'ArrowDown' || e.key === 'Down')) {
            const pane = panes[activePaneIndex];
            if (pane && pane.cellsScrollEl) {
                e.preventDefault();
                pane.cellsScrollEl.scrollBy({ top: 50, behavior: 'auto' });
                return;
            }
        }
        else if (!e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey && (e.key === 'ArrowUp' || e.key === 'Up')) {
            const pane = panes[activePaneIndex];
            if (pane && pane.cellsScrollEl) {
                e.preventDefault();
                pane.cellsScrollEl.scrollBy({ top: -50, behavior: 'auto' });
                return;
            }
        }
        else if (!e.ctrlKey && !e.altKey && !e.metaKey && e.shiftKey && (e.key === 'ArrowDown' || e.key === 'Down')) {
            e.preventDefault();
            selectCell(doc.activeIndex + 1, true);
            return;
        }
        else if (!e.ctrlKey && !e.altKey && !e.metaKey && e.shiftKey && (e.key === 'ArrowUp' || e.key === 'Up')) {
            e.preventDefault();
            selectCell(doc.activeIndex - 1, true);
            return;
        }
        else if (e.key === 'g' && !e.ctrlKey && !e.shiftKey && !e.altKey) {
            e.preventDefault();
            doc.gKeyPressCount++;
            if (doc.gKeyPressCount === 2) {
                clearTimeout(gKeyTimeout);
                doc.gKeyPressCount = 0;
                if (doc.numberBuffer !== '') {
                    const targetNum = parseInt(doc.numberBuffer, 10);
                    doc.numberBuffer = '';
                    const targetIndex = targetNum - 1;
                    if (targetIndex >= 0 && targetIndex < doc.cells.length) {
                        selectCell(targetIndex);
                        recenterActiveCellTop();
                    }
                } else {
                    selectCell(0);
                    recenterActiveCellTop();
                }
            } else {
                clearTimeout(gKeyTimeout);
                gKeyTimeout = setTimeout(() => {
                    doc.gKeyPressCount = 0;
                }, 500);
            }
            return;
        }
        else if ((e.key === 'G' && e.shiftKey) || (e.key === 'g' && e.shiftKey)) {
            e.preventDefault();
            selectCell(doc.cells.length - 1);
            recenterActiveCellTop();
            return;
        }

        // Enter: edit cell
        if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey && !e.altKey) {
            e.preventDefault();
            editCell(doc.activeIndex);
            return;
        }

        // A / B: insert cell
        if (e.key.toLowerCase() === 'a' && !e.ctrlKey && !e.altKey && !e.metaKey) {
            e.preventDefault();
            insertCell(doc.activeIndex, 'above');
            return;
        }
        if (e.key.toLowerCase() === 'b' && !e.ctrlKey && !e.altKey && !e.metaKey) {
            e.preventDefault();
            insertCell(doc.activeIndex, 'below');
            return;
        }

        // D, D: delete cell
        if (e.key.toLowerCase() === 'd' && !e.ctrlKey && !e.altKey && !e.metaKey) {
            e.preventDefault();
            doc.dKeyPressCount++;
            if (doc.dKeyPressCount === 2) {
                deleteCell(doc.activeIndex);
                doc.dKeyPressCount = 0;
                clearTimeout(dKeyTimeout);
            } else {
                clearTimeout(dKeyTimeout);
                dKeyTimeout = setTimeout(() => {
                    doc.dKeyPressCount = 0;
                }, 500);
            }
            return;
        }

        // C / X / V: copy, cut, paste
        if (e.key.toLowerCase() === 'c' && !e.ctrlKey && !e.altKey) {
            e.preventDefault();
            copyCell(doc.activeIndex);
            return;
        }
        if (e.key.toLowerCase() === 'x' && !e.ctrlKey && !e.altKey) {
            e.preventDefault();
            cutCell(doc.activeIndex);
            return;
        }
        if (e.key.toLowerCase() === 'v' && !e.ctrlKey && !e.altKey) {
            e.preventDefault();
            pasteCell(doc.activeIndex, e.shiftKey ? 'above' : 'below');
            return;
        }

        // Merge selected cells (Shift + M)
        if (!e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'm') {
            e.preventDefault();
            mergeSelectedCells();
            return;
        }

        // Undo / Redo (Command Mode: z or Ctrl + z; Redo: Shift + z, Ctrl + Shift + z, Ctrl + y)
        if ((e.key.toLowerCase() === 'z' || e.code === 'KeyZ') && !e.altKey) {
            e.preventDefault();
            e.stopPropagation();
            if (e.shiftKey) {
                redoCellOperation();
            } else {
                undoCellOperation();
            }
            return;
        }

        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (e.key.toLowerCase() === 'y' || e.code === 'KeyY')) {
            e.preventDefault();
            e.stopPropagation();
            redoCellOperation();
            return;
        }

        // Select All (Ctrl + A)
        if (e.ctrlKey && e.key.toLowerCase() === 'a') {
            e.preventDefault();
            selectAllCells();
            return;
        }

        // Shift + Enter: preview cell
        if (e.key === 'Enter' && e.shiftKey) {
            e.preventDefault();
            runCell(doc.activeIndex);
            return;
        }
    }
}

// Update Overall Sidebar Visibility (when both File Browser and ToC are hidden, collapse sidebar)
function updateSidebarVisibility() {
    const isFileBrowserVisible = fileBrowser && !fileBrowser.classList.contains('hidden');
    if (sidebarContainer) {
        if (!isFileBrowserVisible && !isTocOpen) {
            sidebarContainer.classList.add('hidden');
        } else {
            sidebarContainer.classList.remove('hidden');
        }
    }
}

// Toggle File Browser
function toggleFileBrowser() {
    if (fileBrowser) {
        fileBrowser.classList.toggle('hidden');
        if (fileBrowser.classList.contains('hidden')) {
            btnToggleSidebar.classList.remove('bg-gray-200', 'text-jupyter-blue');
            btnToggleSidebar.classList.add('text-gray-500');
        } else {
            btnToggleSidebar.classList.add('bg-gray-200', 'text-jupyter-blue');
            btnToggleSidebar.classList.remove('text-gray-500');
        }
        updateSidebarVisibility();
    }
}

// Toggle Table of Contents (ToC)
function toggleToc(forceState) {
    if (typeof forceState === 'boolean') {
        isTocOpen = forceState;
    } else {
        isTocOpen = !isTocOpen;
    }

    if (tocPanel) {
        if (isTocOpen) {
            tocPanel.classList.remove('hidden');
        } else {
            tocPanel.classList.add('hidden');
        }
    }

    if (btnToggleToc) {
        if (isTocOpen) {
            btnToggleToc.classList.add('bg-gray-200', 'text-jupyter-blue');
            btnToggleToc.classList.remove('text-gray-500');
        } else {
            btnToggleToc.classList.remove('bg-gray-200', 'text-jupyter-blue');
            btnToggleToc.classList.add('text-gray-500');
        }
    }

    updateSidebarVisibility();

    if (isTocOpen) {
        renderToc();
    }
}

// Extract Headings (h1, h2, h3) from Document Cells
// Rules:
// 1. Matches lines starting with 1 to 3 '#' (h1, h2, h3)
// 2. Ignores lines inside fenced code blocks
// 3. At most one heading entry per cell (the first heading encountered in that cell)
function extractHeadings(doc) {
    if (!doc || !doc.cells || doc.cells.length === 0) return [];

    const headings = [];
    doc.cells.forEach((cell, cellIndex) => {
        const text = cell.content || '';
        const lines = text.split('\n');
        let inCodeBlock = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
                inCodeBlock = !inCodeBlock;
                continue;
            }

            if (inCodeBlock) continue;

            // Match CommonMark heading: 0-3 leading spaces, 1-3 '#', whitespace, heading text
            const match = line.match(/^\s{0,3}(#{1,3})\s+(.*)$/);
            if (match) {
                const level = match[1].length; // 1 (h1), 2 (h2), 3 (h3)
                let headingText = match[2].trim();
                // Strip optional trailing hashes: e.g. "### Title ###"
                headingText = headingText.replace(/\s+#+\s*$/, '').trim();

                headings.push({
                    cellIndex,
                    level,
                    text: headingText
                });
                // Rule: only the first heading in this cell is included!
                break;
            }
        }
    });

    return headings;
}

// Render Table of Contents List
function renderToc() {
    if (!tocList) return;

    const doc = getActiveDocument();
    if (!doc || !doc.cells || doc.cells.length === 0) {
        tocList.innerHTML = '<div class="text-gray-400 text-center py-4 text-xs">No Active Notebook</div>';
        return;
    }

    const headings = extractHeadings(doc);
    if (headings.length === 0) {
        tocList.innerHTML = '<div class="text-gray-400 text-center py-4 text-xs">No Headings</div>';
        return;
    }

    // Determine active heading: the closest heading whose cellIndex <= doc.activeIndex
    let activeHeadingCellIndex = -1;
    for (let i = 0; i < headings.length; i++) {
        if (headings[i].cellIndex <= doc.activeIndex) {
            activeHeadingCellIndex = headings[i].cellIndex;
        } else {
            break;
        }
    }

    let html = '';
    headings.forEach((h) => {
        const isActive = (h.cellIndex === activeHeadingCellIndex);
        // Indentation: h1 -> 0px, h2 -> 16px, h3 -> 32px
        const indentWidth = (h.level - 1) * 16;
        const activeItemClass = isActive 
            ? 'bg-blue-50/80 text-jupyter-blue font-semibold shadow-xs' 
            : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900';
        const activeBarClass = isActive 
            ? 'bg-jupyter-blue' 
            : 'bg-transparent';
        const cellNumClass = isActive
            ? 'text-jupyter-blue font-bold font-mono'
            : 'text-gray-400 font-mono';

        html += `
            <div class="toc-item flex items-center py-1.5 px-2 rounded cursor-pointer transition-colors text-xs select-none group ${activeItemClass}" data-cell-index="${h.cellIndex}" ${isActive ? 'data-active="true"' : ''} title="[${h.cellIndex + 1}] ${escapeHtml(h.text)}">
                <div style="width: ${indentWidth}px;" class="flex-shrink-0"></div>
                <span class="text-[11px] mr-1.5 flex-shrink-0 select-none ${cellNumClass}">[${h.cellIndex + 1}]</span>
                <span class="w-1 h-3.5 mr-1.5 rounded-full flex-shrink-0 transition-colors ${activeBarClass}"></span>
                <span class="truncate flex-1">${escapeHtml(h.text || '(Untitled Heading)')}</span>
            </div>
        `;
    });

    tocList.innerHTML = html;

    // Attach click listeners to each ToC item: select cell and recenter top (Ctrl+Alt+L equivalent)
    tocList.querySelectorAll('.toc-item').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const cellIdx = parseInt(el.dataset.cellIndex, 10);
            if (!isNaN(cellIdx)) {
                selectCell(cellIdx, false, activePaneIndex);
                recenterActiveCellTop(activePaneIndex);
                renderToc();
            }
        });
    });

    // Auto-scroll ToC list if active item is outside its visible viewport
    const activeItemEl = tocList.querySelector('.toc-item[data-active="true"]');
    if (activeItemEl) {
        activeItemEl.scrollIntoView({ block: 'nearest' });
    }
}

// Create Cell Toolbar HTML
function createCellToolbar(index, cell, doc, paneIdx = activePaneIndex) {
    if (cell.mode === 'edit') return '';
    const displayClass = doc.globalMode === 'command' ? 'flex' : 'hidden';

    return `
        <div class="cell-toolbar absolute right-2 top-1.5 z-10 bg-white border border-gray-200 rounded shadow-sm ${displayClass} items-center space-x-1 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto select-none">
            <button class="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-jupyter-blue hover:bg-gray-100 rounded btn-move-up" title="Move Cell Up (Ctrl+Shift+↑)" onclick="event.stopPropagation(); setActivePane(${paneIdx}); moveCell(${index}, 'up', ${paneIdx})">
                <i class="fa-solid fa-arrow-up text-xs"></i>
            </button>
            <button class="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-jupyter-blue hover:bg-gray-100 rounded btn-move-down" title="Move Cell Down (Ctrl+Shift+↓)" onclick="event.stopPropagation(); setActivePane(${paneIdx}); moveCell(${index}, 'down', ${paneIdx})">
                <i class="fa-solid fa-arrow-down text-xs"></i>
            </button>
            <button class="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-jupyter-blue hover:bg-gray-100 rounded btn-insert-above" title="Insert Cell Above (A)" onclick="event.stopPropagation(); setActivePane(${paneIdx}); insertCell(${index}, 'above', ${paneIdx})">
                <i class="fa-solid fa-square-plus text-xs"></i>
            </button>
            <button class="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-jupyter-blue hover:bg-gray-100 rounded btn-insert-below" title="Insert Cell Below (B)" onclick="event.stopPropagation(); setActivePane(${paneIdx}); insertCell(${index}, 'below', ${paneIdx})">
                <i class="fa-solid fa-circle-plus text-xs"></i>
            </button>
            <button class="w-6 h-6 flex items-center justify-center text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded btn-delete" title="Delete Cell (D, D)" onclick="event.stopPropagation(); setActivePane(${paneIdx}); deleteCell(${index}, ${paneIdx})">
                <i class="fa-solid fa-trash-can text-xs"></i>
            </button>
        </div>
    `;
}

// Emoji Map
const emojiMap = {
    'smile': '😄', 'smiley': '😃', 'grinning': '😀', 'blush': '😊', 'wink': '😉',
    'heart_eyes': '😍', 'kissing_heart': '😘', 'twinkle': '✨', 'sparkles': '✨',
    'heart': '❤️', 'broken_heart': '💔', 'star': '⭐', 'fire': '🔥', 'tada': '🎉',
    'confetti_ball': '🎊', 'check': '✔️', 'heavy_check_mark': '✔️', 'cross': '❌',
    'x': '❌', 'warning': '⚠️', 'bulb': '💡', 'ok_hand': '👌', 'thumbsup': '👍',
    'thumbsdown': '👎', 'clap': '👏', 'pray': '🙏', 'eyes': '👀', 'rocket': '🚀',
    'sleeping': '😴', 'cry': '😢', 'sob': '😭', 'thinking': '🤔', 'rage': '😡',
    'scream': '😱', 'laughing': '😆', 'sweat_smile': '😅', 'joy': '😂', 'yum': '😋',
    'stuck_out_tongue': '😛', 'sunglasses': '😎', 'mask': '😷', 'innocent': '😇',
    'devil': '😈', 'ghost': '👻', 'alien': '👽', 'skull': '💀', 'poop': '💩',
    'monkey': '🐒', 'dog': '🐶', 'cat': '🐱', 'mouse': '🐭', 'rabbit': '🐰',
    'fox': '🦊', 'bear': '🐻', 'panda': '🐼', 'koala': '🐨', 'tiger': '🐯',
    'lion': '🦁', 'cow': '🐮', 'pig': '🐷', 'frog': '🐸', 'octopus': '🐙',
    'bee': '🐝', 'flower': '🌸', 'rose': '🌹', 'sun': '☀️', 'moon': '🌙',
    'cloud': '☁️', 'rain': '☔', 'snow': '❄️', 'zap': '⚡', 'computer': '💻',
    'phone': '📱', 'watch': '⌚', 'camera': '📷', 'book': '📖', 'moneybag': '💰',
    'gift': '🎁', 'balloon': '🎈', 'trophy': '🏆', 'soccer': '⚽', 'coffee': '☕',
    'beer': '🍺', 'wine_glass': '🍷', 'pizza': '🍕', 'hamburger': '🍔', 'sushi': '🍣',
    'cake': '🍰', 'apple': '🍎', 'banana': '🍌', 'airplane': '✈️', 'anchor': '⚓',
    'hourglass': '⌛', 'key': '🔑', 'lock': '🔒', 'unlock': '🔓', 'memo': '📝',
    'pencil2': '✏️', 'question': '❓', 'exclamation': '❗'
};

function replaceEmojiShortcodes(text) {
    if (!text) return '';
    return text.replace(/:([a-z0-9_+-]+):/g, (match, name) => {
        return emojiMap[name.toLowerCase()] || match;
    });
}

// Convert Unicode emojis into Twemoji SVG images for crisp vector display & printing
function applyTwemojiToElement(element) {
    if (!element) return;
    if (typeof twemoji !== 'undefined' && twemoji.parse) {
        twemoji.parse(element, {
            folder: 'svg',
            ext: '.svg',
            base: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/'
        });
    }
}


// Attach Textarea Events
function attachTextareaEvents(textarea, index, cell, paneIdx) {
    autoResizeTextarea(textarea, paneIdx);
    updateCommentBackdrop(textarea, cell.id);
    updateLineNumbers(textarea, cell.id);

    const triggerCaretUpdate = () => {
        requestAnimationFrame(() => updateCellCaretAndHighlight(textarea, cell.id));
    };

    textarea.addEventListener('input', () => {
        autoResizeTextarea(textarea, paneIdx);
        updateLineNumbers(textarea, cell.id);
        cell.content = textarea.value;
        const doc = getPaneActiveDocument(paneIdx);
        if (doc) markModified(true, doc);
        triggerCaretUpdate();
        updateCommentBackdrop(textarea, cell.id);

        // Update cell number badge if status changed
        const cellEl = document.getElementById(`cell-container-${cell.id}`);
        if (cellEl) {
            const hasComment = hasTodoOrNoteComment(cell.content);
            const numContainer = cellEl.querySelector('.w-8');
            if (numContainer) {
                const cellIndex = doc ? doc.cells.indexOf(cell) : -1;
                const displayIndex = cellIndex !== -1 ? cellIndex + 1 : 1;
                if (hasComment) {
                    numContainer.className = 'w-8 flex-shrink-0 text-right text-xs pt-2';
                    numContainer.innerHTML = `<span class="cell-number-badge-comment">[${displayIndex}]</span>`;
                } else {
                    numContainer.className = 'w-8 flex-shrink-0 text-right text-xs text-jupyter-blue font-semibold pt-2';
                    numContainer.innerHTML = `[${displayIndex}]`;
                }
            }
        }
        updatePaneScrollMarkers(paneIdx);
    });

    textarea.addEventListener('scroll', () => {
        const backdrop = document.getElementById(`comment-backdrop-${cell.id}`);
        if (backdrop) backdrop.scrollTop = textarea.scrollTop;
        const gutter = document.getElementById(`line-numbers-${cell.id}`);
        if (gutter) gutter.scrollTop = textarea.scrollTop;
    });

    ['keydown', 'keyup', 'click', 'focus', 'select'].forEach(evt => {
        textarea.addEventListener(evt, triggerCaretUpdate);
    });

    ['compositionstart', 'compositionupdate', 'compositionend'].forEach(evt => {
        textarea.addEventListener(evt, triggerCaretUpdate);
    });

    textarea.addEventListener('blur', () => {
        // Hide custom block cursor and line highlight on blur
        const highlightEl = document.getElementById(`line-highlight-${cell.id}`);
        const cursorEl = document.getElementById(`block-cursor-${cell.id}`);
        if (highlightEl) highlightEl.classList.add('hidden');
        if (cursorEl) cursorEl.classList.add('hidden');

        cell.content = textarea.value;
        try {
            cell.cursorPos = textarea.selectionStart;
        } catch (e) {}

        if (isSwitchingTabOrPane) {
            return;
        }

        // If prompt bar is active (Replace / Go to Line) or focus is inside prompt bar, preserve edit mode
        if (activePromptState !== null) {
            return;
        }

        // If rename is currently in progress or context menu is active, preserve edit mode
        if (cellStateBeforeRename !== null || isInlineRenaming) {
            return;
        }
        const activeEl = document.activeElement;
        if (activeEl && (activeEl.classList.contains('notebook-name-input') || activeEl.classList.contains('rename-file-input') || activeEl.closest('#file-context-menu') || activeEl.closest('.pane-prompt-bar') || activeEl.classList.contains('prompt-input'))) {
            return;
        }

        // If focus moved to a different pane, preserve edit mode in this pane!
        if (activePaneIndex !== paneIdx) {
            return;
        }

        const doc = getPaneActiveDocument(paneIdx);
        if (doc && cell.mode === 'edit') {
            setTimeout(() => {
                if (isSwitchingTabOrPane) return;
                if (activePromptState !== null) return;
                if (cellStateBeforeRename !== null || isInlineRenaming) return;
                const curActive = document.activeElement;
                if (curActive && (curActive.classList.contains('notebook-name-input') || curActive.classList.contains('rename-file-input') || curActive.closest('#file-context-menu') || curActive.closest('.pane-prompt-bar') || curActive.classList.contains('prompt-input'))) {
                    return;
                }
                if (getPaneActiveDocument(paneIdx) !== doc) return;
                if (activePaneIndex !== paneIdx) return;

                const currentIdx = doc.cells.indexOf(cell);
                if (currentIdx !== -1 && cell.mode === 'edit') {
                    if (doc.activeIndex !== currentIdx) {
                        cell.content = textarea.value;
                        cell.mode = 'view';
                        renderCellAt(currentIdx, paneIdx);
                        return;
                    }

                    cell.content = textarea.value;
                    cell.mode = 'view';
                    renderCellAt(currentIdx, paneIdx);
                    setDocGlobalMode('command', doc);
                    selectCell(currentIdx, false, paneIdx);
                }
            }, 120);
        }
    });

    textarea.addEventListener('keydown', (e) => {
        const doc = getPaneActiveDocument(paneIdx);
        if (!doc) return;

        // Line deletion (Ctrl + Shift + K)
        if (e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey && (e.key.toLowerCase() === 'k' || e.code === 'KeyK')) {
            e.preventDefault();
            e.stopPropagation();
            deleteLineInTextarea(textarea, cell, paneIdx);
            return;
        }

        // Line duplication (Ctrl + Shift + D)
        if (e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey && (e.key.toLowerCase() === 'd' || e.code === 'KeyD')) {
            e.preventDefault();
            e.stopPropagation();
            duplicateLineInTextarea(textarea, cell, paneIdx);
            return;
        }

        // Line move up/down (Ctrl + Shift + Up / Down)
        if (e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey && (e.key === 'ArrowUp' || e.key === 'Up')) {
            e.preventDefault();
            e.stopPropagation();
            moveLineInTextarea(textarea, cell, paneIdx, 'up');
            return;
        }
        if (e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey && (e.key === 'ArrowDown' || e.key === 'Down')) {
            e.preventDefault();
            e.stopPropagation();
            moveLineInTextarea(textarea, cell, paneIdx, 'down');
            return;
        }

        // Bold text (Ctrl + B)
        if (e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey && (e.key.toLowerCase() === 'b' || e.code === 'KeyB')) {
            e.preventDefault();
            e.stopPropagation();
            wrapSelectionInTextarea(textarea, cell, paneIdx, '**');
            return;
        }

        // Italic text (Ctrl + I)
        if (e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey && (e.key.toLowerCase() === 'i' || e.code === 'KeyI')) {
            e.preventDefault();
            e.stopPropagation();
            wrapSelectionInTextarea(textarea, cell, paneIdx, '*');
            return;
        }

        // Move to start of line (Ctrl + Left)
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (e.key === 'ArrowLeft' || e.key === 'Left')) {
            e.preventDefault();
            e.stopPropagation();
            const text = textarea.value;
            const selStart = textarea.selectionStart;
            const lineStart = text.lastIndexOf('\n', selStart - 1) + 1;
            textarea.setSelectionRange(lineStart, lineStart);
            triggerCaretUpdate();
            return;
        }

        // Move to end of line (Ctrl + Right)
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (e.key === 'ArrowRight' || e.key === 'Right')) {
            e.preventDefault();
            e.stopPropagation();
            const text = textarea.value;
            const selEnd = textarea.selectionEnd;
            const nextNl = text.indexOf('\n', selEnd);
            const lineEnd = nextNl === -1 ? text.length : nextNl;
            textarea.setSelectionRange(lineEnd, lineEnd);
            triggerCaretUpdate();
            return;
        }

        // Move to start of cell (Ctrl + Up)
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (e.key === 'ArrowUp' || e.key === 'Up')) {
            e.preventDefault();
            e.stopPropagation();
            textarea.setSelectionRange(0, 0);
            triggerCaretUpdate();
            scrollStartLineIntoViewIfNeeded(textarea, paneIdx);
            return;
        }

        // Move to end of cell (Ctrl + Down)
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (e.key === 'ArrowDown' || e.key === 'Down')) {
            e.preventDefault();
            e.stopPropagation();
            const endPos = textarea.value.length;
            textarea.setSelectionRange(endPos, endPos);
            triggerCaretUpdate();
            scrollEndLineIntoViewIfNeeded(textarea, paneIdx);
            return;
        }

        // In-Cell String Replacement (Ctrl + H)
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'h') {
            e.preventDefault();
            e.stopPropagation();
            openReplacePrompt(paneIdx);
            return;
        }

        // In-Cell Go to Line (Ctrl + G)
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'g') {
            e.preventDefault();
            e.stopPropagation();
            openGoToLinePrompt(paneIdx);
            return;
        }

        if (isMinusKeyEvent(e)) {
            e.preventDefault();
            e.stopPropagation();
            const currentIdx = doc.cells.findIndex(c => c.id === cell.id);
            if (currentIdx !== -1) {
                splitCell(currentIdx, paneIdx);
            }
            return;
        }

        if (e.ctrlKey && (e.key === '/' || e.code === 'Slash')) {
            e.preventDefault();
            e.stopPropagation();
            toggleComment(textarea);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            const currentIdx = doc.cells.indexOf(cell);
            if (currentIdx !== -1) {
                cell.content = textarea.value;
                cell.mode = 'view';
                renderCellAt(currentIdx, paneIdx);
                setDocGlobalMode('command', doc);
                selectCell(currentIdx, false, paneIdx);
            }
        } else if ((e.key === 'Enter' || e.keyCode === 13) && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();
            const currentIdx = doc.cells.indexOf(cell);
            if (currentIdx !== -1) {
                cell.content = textarea.value;
                cell.mode = 'view';
                renderCellAt(currentIdx, paneIdx);
                setDocGlobalMode('command', doc);
                selectCell(currentIdx, false, paneIdx);
            }
        } else if (e.key === 'Enter' && e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();
            const currentIdx = doc.cells.indexOf(cell);
            if (currentIdx !== -1) {
                cell.content = textarea.value;
                runCell(currentIdx, paneIdx);
            }
        }
    });
}

// --- Application Shutdown & WebSocket Disconnect Detection ---

// Establish a WebSocket connection to let the server know this UI is active.
// When all UIs disconnect (e.g. tabs closed), the server will shut down automatically.
function connectWebSocket() {
    const ws = new WebSocket(`ws://${location.host}/ws`);
    ws.onclose = () => {
        console.log("WebSocket disconnected");
    };
}
connectWebSocket();

// Handle the explicit "Quit" button and shortcut
async function executeQuit() {
    if (confirm("Are you sure you want to quit the application?")) {
        try {
            await fetch('/api/shutdown', { method: 'POST' });
            // Replace the entire body with a closed message
            document.body.innerHTML = `
                <div class="h-screen w-screen flex flex-col items-center justify-center bg-gray-900 text-white">
                    <div class="text-4xl mb-4"><i class="fas fa-power-off"></i></div>
                    <h1 class="text-2xl font-bold mb-2">Application Closed</h1>
                    <p class="text-gray-400">The local server has been shut down successfully.</p>
                    <p class="text-gray-400 mt-2">You can safely close this browser tab.</p>
                </div>
            `;
        } catch (e) {
            console.error("Error shutting down:", e);
            alert("Failed to shut down the server. It might already be closed.");
        }
    }
}

const quitBtn = document.getElementById('quit-btn');
if (quitBtn) {
    quitBtn.addEventListener('click', executeQuit);
}

// Global safeguard: Prevent browser undo/redo from mutating notebook-name-input when not actively editing it
document.addEventListener('beforeinput', (e) => {
    if (e.inputType === 'historyUndo' || e.inputType === 'historyRedo') {
        const target = e.target;
        if (target && target.classList && target.classList.contains('notebook-name-input')) {
            if (target.dataset.isEditing !== 'true' || document.activeElement !== target) {
                e.preventDefault();
                e.stopPropagation();
            }
        }
    }
}, true);

document.addEventListener('input', (e) => {
    const target = e.target;
    if (target && target.classList && target.classList.contains('notebook-name-input')) {
        if (target.dataset.isEditing !== 'true' || document.activeElement !== target) {
            for (let i = 0; i < openPaneCount; i++) {
                if (panes[i].nameInputEl === target) {
                    const doc = getPaneActiveDocument(i);
                    if (doc && target.value !== doc.filename) {
                        target.value = doc.filename;
                        target.defaultValue = doc.filename;
                    }
                    break;
                }
            }
        }
    }
}, true);

