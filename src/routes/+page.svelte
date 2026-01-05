<script lang="ts">
    import { editorStore } from '$lib/stores/editor.svelte';
    import { FileText, Folder, FolderOpen, Menu, Save, Eye, PenLine, ArrowLeft } from '@lucide/svelte';
    import { marked } from 'marked';

    let isSidebarOpen = $state(true);
    let isPreviewMode = $state(false);
    let isSaving = $state(false);

    function toggleSidebar() { isSidebarOpen = !isSidebarOpen; }

    async function handleSave() {
        isSaving = true;
        await editorStore.saveContent();
        setTimeout(() => { isSaving = false; }, 800);
    }

    function handleKeydown(e: KeyboardEvent) {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            handleSave();
        }
    }

    let renderedContent = $derived(marked.parse(editorStore.content));
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="h-screen flex overflow-hidden bg-surface-50 text-surface-900 font-typewriter">
    
    <aside class={`
        w-64 bg-surface-100 border-r border-surface-200 flex flex-col transition-all duration-300
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full absolute z-50 h-full'}
        md:relative md:translate-x-0
    `}>
        <div class="p-4 border-b border-surface-200 flex items-center gap-3">
            <img src="/app-icon.png" alt="Logo" class="w-8 h-8 pixelated" />
            <span class="font-bold text-lg tracking-tight">MilkyNote</span>
        </div>

        {#if editorStore.currentPath !== editorStore.rootPath}
            <div class="p-2 border-b border-surface-200 bg-surface-200/50">
                <button 
                    class="flex items-center gap-2 text-sm text-surface-700 hover:text-primary-700 w-full px-2 py-1"
                    onclick={() => editorStore.goBack()}
                >
                    <ArrowLeft size={16} />
                    <span>Kembali / Back</span>
                </button>
            </div>
        {/if}

        <div class="flex-1 overflow-y-auto p-2 space-y-1">
            {#each editorStore.files as file}
                <button 
                    class={`flex items-center gap-2 text-sm w-full text-left py-1.5 px-2 rounded-md transition-colors
                    ${editorStore.activeFileId === file.name ? 'bg-primary-100 text-primary-900 font-bold' : 'text-surface-600 hover:bg-surface-200'}
                    `}
                    onclick={() => editorStore.handleItemClick(file)}
                >
                    {#if file.is_dir}
                        <Folder size={16} class="text-yellow-600 fill-yellow-100" />
                    {:else}
                        <FileText size={14} class="text-surface-400" />
                    {/if}
                    
                    <span class="truncate">{file.name}</span>
                </button>
            {/each}
        </div>
        
        <div class="p-2 text-[10px] text-surface-400 break-all border-t border-surface-200">
            {editorStore.currentPath.replace('/home/priosmilky/Documents', '...')}
        </div>
    </aside>

    <main class="flex-1 flex flex-col h-full bg-white relative">
        <header class="h-14 border-b border-surface-200 flex items-center justify-between px-6 bg-surface-50/50 backdrop-blur-sm">
            <div class="flex items-center gap-4">
                <button class="md:hidden p-2 hover:bg-surface-200 rounded" onclick={toggleSidebar}>
                    <Menu size={20} />
                </button>
                <div class="text-sm breadcrumbs">
                    <span class="opacity-50">Editor /</span>
                    <span class="font-bold">{editorStore.activeFileName || '...'}</span>
                </div>
            </div>
            
            <div class="flex items-center gap-3">
                <button class="p-1.5 rounded hover:bg-surface-200" onclick={() => isPreviewMode = !isPreviewMode}>
                    {#if isPreviewMode}<PenLine size={18} />{:else}<Eye size={18} />{/if}
                </button>
                <button onclick={handleSave} class="text-xs flex items-center gap-1 {isSaving ? 'text-primary-600' : 'text-surface-400'}">
                    <Save size={14} /> {isSaving ? 'Saving...' : 'Simpan'}
                </button>
            </div>
        </header>

        <div class="flex-1 overflow-y-auto relative">
            <div class="max-w-3xl mx-auto px-8 py-10 min-h-full flex flex-col">
                {#if isPreviewMode}
                    <article class="prose prose-slate max-w-none font-sans">
                        {@html renderedContent}
                    </article>
                {:else}
                    <textarea
                        bind:value={editorStore.content}
                        class="w-full flex-1 bg-transparent border-none focus:ring-0 resize-none outline-none text-lg leading-relaxed text-surface-700 font-typewriter"
                        placeholder="Klik folder di kiri untuk membuka file..."
                        spellcheck="false"
                    ></textarea>
                {/if}
                <div class="h-20"></div>
            </div>
        </div>
        
        <div class="h-8 bg-surface-100 border-t border-surface-200 flex items-center justify-between px-4 text-xs font-mono text-surface-500">
            <div class="flex gap-4">
                <span>{editorStore.wordCount} WORDS</span>
                <span>{editorStore.charCount} CHARS</span>
            </div>
        </div>
    </main>
</div>

<style>
    :global(.prose h1) { font-size: 2.25em; font-weight: 800; margin-bottom: 0.5em; letter-spacing: -0.025em; }
    :global(.prose h2) { font-size: 1.5em; font-weight: 700; margin-top: 1.5em; margin-bottom: 0.5em; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.3em; }
    :global(.prose p) { margin-bottom: 1.25em; line-height: 1.75; }
    :global(.prose ul) { list-style-type: disc; padding-left: 1.5em; margin-bottom: 1.25em; }
</style>