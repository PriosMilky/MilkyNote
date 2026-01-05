<script lang="ts">
    import { editorStore } from '$lib/stores/editor.svelte';
    import { 
        FileText, Folder, Save, Eye, PenLine, Trash2,
        ArrowLeft, Plus, FolderPlus, Download, ChevronDown,
        PanelLeftClose, PanelLeftOpen 
    } from '@lucide/svelte';
    import { marked } from 'marked';
    import { save } from '@tauri-apps/plugin-dialog';
    import { writeFile } from '@tauri-apps/plugin-fs';
    import { jsPDF } from 'jspdf';
    import * as docx from 'docx';
    import { type } from '@tauri-apps/plugin-os'; // Import untuk deteksi platform di UI

    const { Document, Packer, Paragraph, TextRun, Footer, PageNumber } = docx;

    let isPreviewMode = $state(false);
    let isSaving = $state(false);
    let showExportMenu = $state(false);
    let isSidebarOpen = $state(true); // Default sidebar terbuka di desktop
    let hasUnsavedChanges = $state(false);
    let isMobile = $state(false); // State untuk mendeteksi mode mobile

    // Deteksi platform saat aplikasi pertama kali dimuat
    $effect(() => {
        // Buat fungsi internal async agar TypeScript tidak error
        async function checkPlatform() {
            try {
                const platform = await type();
                isMobile = (platform === 'android' || platform === 'ios');
                if (isMobile) {
                    isSidebarOpen = false; 
                }
            } catch (e) {
                console.error("Gagal deteksi platform:", e);
            }
        }
        
        checkPlatform();
    });

    async function handleSave() {
        if (!editorStore.activeFileName) return;
        isSaving = true;
        await editorStore.saveContent();
        hasUnsavedChanges = false; // Reset indikator
        setTimeout(() => (isSaving = false), 800);
    }

    function handleKeydown(e: KeyboardEvent) {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            handleSave();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'b' && !isMobile) { // Shortcut sidebar hanya di desktop
            e.preventDefault();
            isSidebarOpen = !isSidebarOpen; 
        }
    }

    // Deteksi perubahan konten untuk indikator "Belum Disimpan"
    $effect(() => {
        if (editorStore.content && editorStore.activeFileId) {
            // Bisa diperbaiki dengan membandingkan konten awal, tapi ini cukup untuk indikator cepat
            hasUnsavedChanges = true;
        }
    });

    async function runExport(format: string) {
        showExportMenu = false;
        const content = await editorStore.getMergedContent();
        // Export di mobile akan berbeda, biasanya tidak ada dialog "Save As"
        // Untuk sekarang, kita asumsikan ini hanya akan dipakai di Desktop
        // Atau kamu perlu implementasi share sheet di mobile
        if (isMobile) {
             alert('Fitur export langsung belum tersedia di mobile. Harap sinkronisasi file Anda.');
             return;
        }

        const folderName = editorStore.currentPath.split('/').pop() || 'naskah';

        const path = await save({
            filters: [{ name: format, extensions: [format.toLowerCase()] }],
            defaultPath: `${folderName}.${format.toLowerCase()}`
        });

        if (!path) return;

        try {
            if (format === 'MD') {
                await writeFile(path, new TextEncoder().encode(content));
            } else if (format === 'PDF') {
                const doc = new jsPDF();
                const pageWidth = doc.internal.pageSize.getWidth();
                const pageHeight = doc.internal.pageSize.getHeight();
                const margin = 15;
                const lines = doc.splitTextToSize(content, pageWidth - margin * 2);
                let cursorY = margin;

                lines.forEach((line: string) => {
                    if (cursorY > pageHeight - margin) {
                        doc.addPage();
                        cursorY = margin;
                    }
                    doc.text(line, margin, cursorY);
                    cursorY += 7;
                });
                await writeFile(path, new Uint8Array(doc.output('arraybuffer')));
            } else if (format === 'DOCX') {
                const lines = content.split('\n');
                const docChildren: any[] = [];

                lines.forEach((line) => {
                    const trimmedLine = line.trim();
                    if (trimmedLine.startsWith('# ')) {
                        docChildren.push(
                            new Paragraph({
                                text: trimmedLine.replace('# ', ''),
                                heading: 'Heading1',
                                spacing: { before: 400, after: 200 }
                            })
                        );
                    } else if (trimmedLine === '---') {
                        docChildren.push(
                            new Paragraph({
                                border: { bottom: { color: 'auto', space: 1, style: 'single', size: 6 } },
                                spacing: { after: 200 }
                            })
                        );
                    } else if (trimmedLine !== '') {
                        docChildren.push(
                            new Paragraph({
                                children: [new TextRun({ text: trimmedLine, size: 24, font: 'Courier New' })],
                                spacing: { line: 360, after: 200 },
                                alignment: 'both'
                            })
                        );
                    }
                });

                const doc = new Document({
                    sections: [
                        {
                            footers: {
                                default: new Footer({
                                    children: [
                                        new Paragraph({
                                            alignment: 'center',
                                            children: [new TextRun('Halaman '), new TextRun({ children: [PageNumber.CURRENT] })]
                                        })
                                    ]
                                })
                            },
                            children: docChildren
                        }
                    ]
                });

                const blob = await Packer.toBlob(doc);
                const arrayBuffer = await blob.arrayBuffer();
                await writeFile(path, new Uint8Array(arrayBuffer));
            }
            alert('Export Berhasil ke: ' + path);
        } catch (err) {
            alert('Gagal export: ' + err);
        }
    }

    let renderedContent = $derived(marked.parse(editorStore.content));
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="h-screen flex bg-surface-50 text-surface-900 overflow-hidden font-sans">
    <aside 
        class="bg-surface-100 border-r border-surface-200 flex flex-col transition-all duration-300 ease-in-out overflow-hidden"
        style="width: {isSidebarOpen ? (isMobile ? '80%' : '260px') : '0px'}; opacity: {isSidebarOpen ? '1' : '0'}"
    >
        <div class="p-4 border-b flex items-center justify-between bg-white/50 min-w-[260px]">
            <span class="font-bold tracking-tight text-primary-900">MilkyNote</span>
            <div class="flex gap-1">
                <button
                    onclick={() => editorStore.createNewFolder(prompt('Nama Folder Baru:') || '')}
                    class="p-1 hover:bg-surface-200 rounded text-surface-600"
                    title="Folder Baru"><FolderPlus size={16} /></button
                >
                <button
                    onclick={() => editorStore.createNewFile(prompt('Nama File Baru:') || '')}
                    class="p-1 hover:bg-surface-200 rounded text-surface-600"
                    title="File Baru"><Plus size={18} /></button
                >
            </div>
        </div>

        {#if editorStore.currentPath !== editorStore.rootPath}
            <button
                class="flex items-center gap-2 p-2 text-xs font-bold uppercase tracking-wider bg-surface-200/50 hover:bg-surface-200 border-b border-surface-200 min-w-[260px]"
                onclick={() => editorStore.goBack()}
            >
                <ArrowLeft size={14} /> Kembali
            </button>
        {/if}

        <div class="flex-1 overflow-y-auto p-2 space-y-0.5 min-w-[260px]">
            {#each editorStore.files as file}
                <div class="group flex items-center gap-1">
                    <button
                        class="flex-1 flex items-center gap-2 text-sm p-2 rounded transition-all {editorStore.activeFileId ===
                        file.name
                            ? 'bg-primary-100 text-primary-950 font-medium'
                            : 'hover:bg-surface-200'}"
                        onclick={() => editorStore.handleItemClick(file)}
                    >
                        {#if file.is_dir}<Folder
                                size={16}
                                class="text-yellow-600 fill-yellow-100"
                            />{:else}<FileText size={14} class="opacity-50" />{/if}
                        <span class="truncate">{file.name}</span>
                    </button>

                    <div class="hidden group-hover:flex gap-1 pr-1">
                        <button
                            onclick={() => editorStore.renameItem(file.name)}
                            class="p-1 hover:text-primary-600 opacity-50 hover:opacity-100"
                            ><PenLine size={12} /></button
                        >
                        <button
                            onclick={() => editorStore.deleteItem(file.name)}
                            class="p-1 hover:text-red-600 opacity-50 hover:opacity-100"
                            ><Trash2 size={12} /></button
                        >
                    </div>
                </div>
            {/each}
        </div>
    </aside>

    <main class="flex-1 flex flex-col bg-white overflow-hidden">
        <header
            class="h-14 border-b flex items-center justify-between px-6 bg-surface-50/30 backdrop-blur-sm"
        >
            <div class="flex items-center gap-4">
                <button 
                    onclick={() => isSidebarOpen = !isSidebarOpen}
                    class="p-2 hover:bg-surface-200 rounded-md transition-colors text-surface-600"
                    title={isSidebarOpen ? "Sembunyikan Sidebar" : "Tampilkan Sidebar"}
                >
                    {#if isSidebarOpen}<PanelLeftClose size={20}/>{:else}<PanelLeftOpen size={20}/>{/if}
                </button>

                <div class="text-sm font-medium opacity-70 italic flex items-center">
                    {editorStore.activeFileName || 'Menunggu naskah...'}
                    {#if hasUnsavedChanges}
                        <span class="ml-2 text-amber-500 text-[10px] uppercase font-bold tracking-widest">• Belum Disimpan</span>
                    {/if}
                </div>
            </div>

            <div class="flex items-center gap-3">
                <div class="relative">
                    <button
                        onclick={() => (showExportMenu = !showExportMenu)}
                        class="flex items-center gap-1 text-xs bg-surface-200 px-3 py-1.5 rounded hover:bg-surface-300 transition-colors"
                    >
                        <Download size={14} /> Export <ChevronDown size={12} />
                    </button>
                    {#if showExportMenu}
                        <div
                            class="absolute right-0 mt-2 w-40 bg-white border border-surface-200 shadow-xl rounded-md z-50 flex flex-col py-1"
                        >
                            <button
                                onclick={() => runExport('PDF')}
                                class="px-4 py-2 text-left text-sm hover:bg-primary-50">PDF (.pdf)</button
                            >
                            <button
                                onclick={() => runExport('DOCX')}
                                class="px-4 py-2 text-left text-sm hover:bg-primary-50"
                                >Word (.docx)</button
                            >
                            <button
                                onclick={() => runExport('MD')}
                                class="px-4 py-2 text-left text-sm hover:bg-primary-50"
                                >Markdown (.md)</button
                            >
                        </div>
                    {/if}
                </div>
                <button
                    onclick={() => (isPreviewMode = !isPreviewMode)}
                    class="p-2 hover:bg-surface-200 rounded-full transition-colors"
                >
                    {#if isPreviewMode}<PenLine size={18} />{:else}<Eye size={18} />{/if}
                </button>
                <button
                    onclick={handleSave}
                    class="p-2 hover:bg-surface-200 rounded-full transition-colors {isSaving
                        ? 'text-primary-600'
                        : 'text-surface-400'}"
                >
                    <Save size={18} />
                </button>
            </div>
        </header>

        <div class="flex-1 overflow-y-auto p-10 bg-[#fdfdfd]">
            <div class="max-w-3xl mx-auto h-full">
                {#if isPreviewMode}
                    <article class="prose prose-slate max-w-none">{@html renderedContent}</article>
                {:else}
                    <textarea
                        bind:value={editorStore.content}
                        class="w-full h-full resize-none outline-none leading-relaxed text-surface-800 bg-transparent"
                        style="font-family: 'Courier Prime', 'Courier New', monospace; font-size: 14px;"
                        placeholder="Ketukan tuts mesin tik menantimu..."
                    ></textarea>
                {/if}
            </div>
        </div>

        <footer
            class="h-8 bg-surface-100/50 border-t flex items-center justify-between px-4 text-[10px] font-mono text-surface-400 uppercase tracking-widest"
        >
            <div class="flex gap-4">
                <span>{editorStore.wordCount} Kata</span>
                <span>{editorStore.charCount} Karakter</span>
            </div>
            <div>MilkyNote v1.0</div>
        </footer>
    </main>
</div>