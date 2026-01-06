<script lang="ts">
    import { editorStore } from '$lib/stores/editor.svelte';
    import { join } from '@tauri-apps/api/path';
    import { 
        FileText, Folder, Save, Eye, PenLine, Trash2,
        ArrowLeft, Plus, FolderPlus, Download, ChevronDown,
        PanelLeftClose, PanelLeftOpen, X, Check
    } from '@lucide/svelte';
    import { marked } from 'marked';
    import { save } from '@tauri-apps/plugin-dialog';
    import { writeFile, readDir, readTextFile } from '@tauri-apps/plugin-fs';
    import { jsPDF } from 'jspdf';
    import * as docx from 'docx';
    import { type } from '@tauri-apps/plugin-os';

    const { Document, Packer, Paragraph, TextRun, Footer, PageNumber } = docx;

    // --- STATE ---
    let isPreviewMode = $state(false);
    let isSaving = $state(false);
    let showExportMenu = $state(false);
    let isSidebarOpen = $state(true);
    let hasUnsavedChanges = $state(false);
    let isMobile = $state(false);

    // --- MODAL STATE ---
    let showModal = $state(false);
    let modalType = $state<'newFile' | 'newFolder' | 'rename' | 'delete'>('newFile');
    let modalInput = $state('');
    let modalTargetItem = $state<any>(null);

    // --- INIT ---
    $effect(() => {
        async function checkPlatform() {
            try {
                const platform = await type();
                isMobile = (platform === 'android' || platform === 'ios');
                if (isMobile) isSidebarOpen = false; 
            } catch (e) { console.error("Gagal deteksi platform:", e); }
        }
        checkPlatform();
    });

    // --- LOGIC MODAL ---
    function openModal(type: 'newFile' | 'newFolder' | 'rename' | 'delete', item: any = null) {
        modalType = type;
        modalTargetItem = item;
        modalInput = item ? item.name : '';
        showModal = true;
        setTimeout(() => document.getElementById('modal-input')?.focus(), 100);
    }

    async function submitModal() {
        if (!modalInput && modalType !== 'delete') return;
        showModal = false;

        if (modalType === 'newFile') {
            await editorStore.createNewFile(modalInput);
        } else if (modalType === 'newFolder') {
            await editorStore.createNewFolder(modalInput);
        } else if (modalType === 'rename' && modalTargetItem) {
            await editorStore.renameItemManual(modalTargetItem.name, modalInput);
        } else if (modalType === 'delete' && modalTargetItem) {
            await editorStore.deleteItemManual(modalTargetItem.name);
        }
        modalInput = '';
    }

    // --- EXPORT LOGIC ---
    async function runExport(format: string) {
        showExportMenu = false;
        try {
            const rootPath = editorStore.currentPath;
            const folderName = rootPath.split('/').pop() || 'Export_MilkyNote';
            let finalContent = "";

            // Fungsi pembantu untuk memproses folder secara mendalam
            async function processFolder(path: string, level = 0) {
                let entries = await readDir(path);
                
                // --- KUNCI PERBAIKAN URUTAN (Natural Sort) ---
                entries.sort((a, b) => {
                    // Folder selalu di atas file
                    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
                    
                    // Urutkan berdasarkan angka (numeric: true) agar 01, 02, 10 berurutan
                    return a.name.localeCompare(b.name, undefined, { 
                        numeric: true, 
                        sensitivity: 'base' 
                    });
                });

                for (const entry of entries) {
                    const fullPath = await join(path, entry.name);
                    
                    if (entry.isDirectory) {
                        finalContent += `\n${'#'.repeat(level + 1)} FOLDER: ${entry.name.toUpperCase()}\n\n`;
                        await processFolder(fullPath, level + 1);
                    } else if (entry.name.endsWith('.md') || entry.name.endsWith('.txt')) {
                        const text = await editorStore.readFileContents(fullPath);
                        finalContent += `\n--- START: ${entry.name} ---\n\n${text}\n\n`;
                    }
                }
            }

            // Mulai proses
            await processFolder(rootPath);

            const fileName = `${folderName}_Full.${format.toLowerCase()}`;
            
            // Logika Save Path (Android 10 & Desktop)
            let savePath: string | null;
            if (isMobile) {
                savePath = await join(rootPath, fileName);
            } else {
                savePath = await save({ defaultPath: fileName });
            }

            if (!savePath) return;

            const data = await generateExportData(format, finalContent);
            await writeFile(savePath, data);
            
            alert(`Berhasil!\nNaskah gabungan disimpan di:\n${savePath}`);
        } catch (err) {
            console.error(err);
            alert('Gagal export folder: ' + err);
        }
    }

    async function generateExportData(format: string, content: string): Promise<Uint8Array> {
        if (format === 'MD') {
            return new TextEncoder().encode(content);
        } else if (format === 'PDF') {
            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const margin = 15;
            const lines = doc.splitTextToSize(content, pageWidth - margin * 2);
            let cursorY = margin;
            lines.forEach((line: string) => {
                if (cursorY > pageHeight - margin) { doc.addPage(); cursorY = margin; }
                doc.text(line, margin, cursorY);
                cursorY += 7;
            });
            return new Uint8Array(doc.output('arraybuffer'));
        } else if (format === 'DOCX') {
            const lines = content.split('\n');
            const docChildren: any[] = [];
            lines.forEach((line) => {
                const trimmed = line.trim();
                if (trimmed.startsWith('# ')) {
                    docChildren.push(new Paragraph({ text: trimmed.replace('# ', ''), heading: 'Heading1', spacing: { before: 400, after: 200 } }));
                } else {
                    docChildren.push(new Paragraph({ children: [new TextRun({ text: trimmed, size: 24, font: 'Courier New' })], spacing: { line: 360, after: 200 } }));
                }
            });
            const doc = new Document({ sections: [{ children: docChildren }] });
            const blob = await Packer.toBlob(doc);
            return new Uint8Array(await blob.arrayBuffer());
        }
        return new Uint8Array();
    }

    // --- SAVE LOGIC ---
    async function handleSave() {
        if (!editorStore.activeFileName) return;
        isSaving = true;
        await editorStore.saveContent();
        hasUnsavedChanges = false;
        setTimeout(() => (isSaving = false), 800);
    }

    function handleKeydown(e: KeyboardEvent) {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleSave(); }
        if (e.key === 'Escape' && showModal) showModal = false;
    }

    let renderedContent = $derived(marked.parse(editorStore.content));
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="h-screen flex bg-surface-50 text-surface-900 overflow-hidden font-sans relative">
    
    {#if showModal}
        <div 
            class="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            role="presentation"
        >
            <div class="bg-white rounded-lg shadow-2xl w-full max-w-xs p-6 border border-surface-200">
                <h3 class="text-lg font-bold mb-4 capitalize">
                    {modalType === 'newFile' ? 'Buat File Baru' : 
                     modalType === 'newFolder' ? 'Buat Folder Baru' : 
                     modalType === 'rename' ? 'Ganti Nama' : 'Hapus Item?'}
                </h3>
                
                {#if modalType !== 'delete'}
                    <input 
                        id="modal-input"
                        type="text" 
                        bind:value={modalInput} 
                        class="w-full border border-surface-300 rounded p-2 mb-4 focus:ring-2 focus:ring-primary-500 outline-none"
                        placeholder="Ketik nama disini..."
                        onkeydown={(e) => e.key === 'Enter' && submitModal()}
                    />
                {:else}
                    <p class="mb-6 text-surface-600">Yakin ingin menghapus <b>{modalTargetItem?.name}</b>? Tindakan ini tidak bisa dibatalkan.</p>
                {/if}

                <div class="flex justify-end gap-2">
                    <button onclick={() => showModal = false} class="px-4 py-2 text-surface-600 hover:bg-surface-100 rounded">Batal</button>
                    <button onclick={submitModal} class="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 font-bold flex items-center gap-1">
                        {#if modalType === 'delete'} <Trash2 size={16}/> Hapus {:else} <Check size={16}/> Simpan {/if}
                    </button>
                </div>
            </div>
        </div>
    {/if}

    {#if isMobile && isSidebarOpen}
        <div 
            role="button"
            tabindex="0"
            class="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:hidden"
            onclick={() => isSidebarOpen = false}
            onkeydown={(e) => { if(e.key === 'Escape' || e.key === 'Enter') isSidebarOpen = false; }}
            aria-label="Tutup Sidebar"
        ></div>
    {/if}

    <aside 
        class="bg-surface-100 border-r border-surface-200 flex flex-col transition-all duration-300 ease-in-out overflow-hidden absolute md:relative h-full z-50 shadow-xl md:shadow-none"
        style="width: {isSidebarOpen ? '260px' : '0px'};"
    >
        <div class="p-4 border-b flex items-center justify-between bg-white/50 min-w-[260px]">
            <div class="flex items-center gap-2">
                <img src="/app-icon.png" class="w-6 h-6 rounded pixelated" alt="Logo"/>
                <span class="font-bold tracking-tight text-primary-900">MilkyNote</span>
            </div>
            <div class="flex gap-1">
                <button onclick={() => openModal('newFolder')} class="p-1 hover:bg-surface-200 rounded text-surface-600" title="Folder Baru"><FolderPlus size={16} /></button>
                <button onclick={() => openModal('newFile')} class="p-1 hover:bg-surface-200 rounded text-surface-600" title="File Baru"><Plus size={18} /></button>
            </div>
        </div>

        {#if editorStore.currentPath !== editorStore.rootPath}
            <button class="flex items-center gap-2 p-2 text-xs font-bold uppercase tracking-wider bg-surface-200/50 hover:bg-surface-200 border-b border-surface-200 min-w-[260px]" onclick={() => editorStore.goBack()}>
                <ArrowLeft size={14} /> Kembali
            </button>
        {/if}

        <div class="flex-1 overflow-y-auto p-2 space-y-0.5 min-w-[260px]">
            {#each editorStore.files as file}
                <div class="group flex items-center gap-1">
                    <button
                        class="flex-1 flex items-center gap-2 text-sm p-2 rounded transition-all {editorStore.activeFileId === file.name ? 'bg-primary-100 text-primary-950 font-medium' : 'hover:bg-surface-200'}"
                        onclick={() => editorStore.handleItemClick(file)}
                    >
                        {#if file.is_dir}
                            <Folder size={16} class="text-yellow-600 fill-yellow-100" />
                        {:else}
                            <FileText size={14} class="opacity-50" />
                        {/if}
                        <span class="truncate">{file.name}</span>
                    </button>

                    <div class="flex gap-1 pr-1 {isMobile ? 'opacity-100' : 'hidden group-hover:flex'}">
                        <button onclick={() => openModal('rename', file)} class="p-1 hover:text-primary-600 text-surface-400"><PenLine size={12} /></button>
                        <button onclick={() => openModal('delete', file)} class="p-1 hover:text-red-600 text-surface-400"><Trash2 size={12} /></button>
                    </div>
                </div>
            {/each}
        </div>
    </aside>

    <main class="flex-1 flex flex-col bg-white overflow-hidden w-full relative">
        <header class="h-14 border-b flex items-center justify-between px-4 md:px-6 bg-surface-50/30 backdrop-blur-sm">
            <div class="flex items-center gap-4">
                <button onclick={(e) => { e.stopPropagation(); isSidebarOpen = !isSidebarOpen; }} class="p-2 hover:bg-surface-200 rounded-md transition-colors text-surface-600">
                    {#if isSidebarOpen}<PanelLeftClose size={20}/>{:else}<PanelLeftOpen size={20}/>{/if}
                </button>
                <div class="text-sm font-medium opacity-70 italic truncate max-w-[150px] md:max-w-xs">
                    {editorStore.activeFileName || '...'}
                    {#if hasUnsavedChanges}<span class="text-amber-500 ml-1">*</span>{/if}
                </div>
            </div>
            
            <div class="flex items-center gap-2">
                <div class="relative">
                    <button onclick={() => (showExportMenu = !showExportMenu)} class="flex items-center gap-1 text-xs bg-surface-200 px-3 py-1.5 rounded hover:bg-surface-300">
                        <Download size={14} /> <span class="hidden md:inline">Export</span>
                    </button>
                    {#if showExportMenu}
                        <div class="absolute right-0 mt-2 w-40 bg-white border border-surface-200 shadow-xl rounded-md z-50 flex flex-col py-1">
                            <button onclick={() => runExport('PDF')} class="px-4 py-2 text-left text-sm hover:bg-primary-50">PDF (.pdf)</button>
                            <button onclick={() => runExport('DOCX')} class="px-4 py-2 text-left text-sm hover:bg-primary-50">Word (.docx)</button>
                            <button onclick={() => runExport('MD')} class="px-4 py-2 text-left text-sm hover:bg-primary-50">Markdown (.md)</button>
                        </div>
                    {/if}
                </div>
                <button onclick={() => (isPreviewMode = !isPreviewMode)} class="p-2 hover:bg-surface-200 rounded-full">{#if isPreviewMode}<PenLine size={18} />{:else}<Eye size={18} />{/if}</button>
                <button onclick={handleSave} class="p-2 hover:bg-surface-200 rounded-full {isSaving ? 'text-primary-600' : 'text-surface-400'}"><Save size={18} /></button>
            </div>
        </header>

        <div class="flex-1 overflow-y-auto p-4 md:p-10 bg-[#fdfdfd]">
            <div class="max-w-3xl mx-auto h-full">
                {#if isPreviewMode}
                    <article class="prose prose-slate max-w-none">{@html renderedContent}</article>
                {:else}
                    <textarea bind:value={editorStore.content} class="w-full h-full resize-none outline-none leading-relaxed text-surface-800 bg-transparent font-typewriter text-sm md:text-base" placeholder="Mulai mengetik..."></textarea>
                {/if}
            </div>
        </div>
    </main>
</div>