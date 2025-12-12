/**
 * Main client-side JavaScript for SVG2Sketch app
 */

// Import dependencies
import { ContextDropdown } from './context-dropdowns.js';

// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
let documentId = urlParams.get('documentId');
let workspaceId = urlParams.get('workspaceId');
let elementId = urlParams.get('elementId');

// State
let currentFile = null;
let svgContent = null;
let detectedPatterns = [];
let documentDropdown = null;
let partStudioDropdown = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    initializeDropdowns();
    loadContext();
    loadPlanes();
    setupPlaneSelectListener();
});

function initializeDropdowns() {
    // Initialize document dropdown
    documentDropdown = new ContextDropdown({
        buttonId: 'documentDropdownButton',
        dropdownId: 'documentDropdown',
        defaultText: 'Select Document',
        onSelect: async (document) => {
            console.log('Document selected:', document);
            documentId = document.id;
            // Fetch workspaces for the document
            await loadWorkspaces(document.id);
            // Update URL without reload
            updateUrlParams();
            // Reload part studios for new document
            await loadPartStudios(document.id);
        }
    });
    
    // Initialize part studio dropdown
    partStudioDropdown = new ContextDropdown({
        buttonId: 'partStudioDropdownButton',
        dropdownId: 'partStudioDropdown',
        defaultText: 'Select Part Studio',
        onSelect: async (partStudio) => {
            console.log('Part Studio selected:', partStudio);
            elementId = partStudio.id;
            // Update URL without reload
            updateUrlParams();
            // Reload planes for new part studio
            await loadPlanes();
        }
    });
    
    // Load all documents
    loadDocuments();
}

function updateUrlParams() {
    const newUrl = new URL(window.location);
    if (documentId) newUrl.searchParams.set('documentId', documentId);
    if (workspaceId) newUrl.searchParams.set('workspaceId', workspaceId);
    if (elementId) newUrl.searchParams.set('elementId', elementId);
    window.history.replaceState({}, '', newUrl);
}

async function loadDocuments() {
    try {
        const response = await fetch('/api/documents', {
            credentials: 'include'
        });
        
        if (response.ok) {
            const documents = await response.json();
            documentDropdown.setItems(documents);
            
            // Select current document if available
            if (documentId) {
                const currentDoc = documents.find(d => d.id === documentId);
                if (currentDoc) {
                    documentDropdown.setSelected(currentDoc);
                }
            }
        } else {
            console.error('Failed to load documents');
        }
    } catch (error) {
        console.error('Error loading documents:', error);
    }
}

async function loadWorkspaces(docId) {
    // For now, we'll use the current workspaceId or fetch default
    // This could be enhanced to fetch all workspaces
    if (!workspaceId && docId) {
        // Try to get default workspace - this would need an API endpoint
        console.log('Loading workspaces for document:', docId);
    }
}

async function loadPartStudios(docId) {
    if (!docId || !workspaceId) return;
    
    try {
        const response = await fetch(
            `/api/elements?documentId=${docId}&workspaceId=${workspaceId}`,
            { credentials: 'include' }
        );
        
        if (response.ok) {
            const partStudios = await response.json();
            partStudioDropdown.setItems(partStudios);
            
            // Select current part studio if available
            if (elementId) {
                const currentStudio = partStudios.find(ps => ps.id === elementId);
                if (currentStudio) {
                    partStudioDropdown.setSelected(currentStudio);
                }
            }
        } else {
            console.error('Failed to load part studios');
        }
    } catch (error) {
        console.error('Error loading part studios:', error);
    }
}

function setupPlaneSelectListener() {
    const planeSelect = document.getElementById('planeSelect');
    const convertButton = document.getElementById('convertButton');
    
    planeSelect.addEventListener('change', () => {
        // Enable convert button if both file and plane are selected
        convertButton.disabled = !planeSelect.value || !currentFile;
        console.log('Plane selected:', planeSelect.value, 'File selected:', !!currentFile, 'Button disabled:', convertButton.disabled);
    });
}

function initializeEventListeners() {
    const fileInput = document.getElementById('fileInput');
    const uploadButton = document.getElementById('uploadButton');
    const convertButton = document.getElementById('convertButton');
    
    uploadButton.addEventListener('click', () => fileInput.click());
    
    fileInput.addEventListener('change', async (event) => {
        await handleFileSelect(event);
    });
    
    convertButton.addEventListener('click', async () => {
        await handleConvert();
    });
}

async function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validate file type
    if (!file.name.toLowerCase().endsWith('.svg')) {
        showStatus('Invalid file type. Please select an SVG file.', 'error');
        return;
    }
    
    // Check file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
        showStatus('File too large. Maximum size is 10MB.', 'error');
        return;
    }
    
    try {
        currentFile = file;
        svgContent = await readFileAsText(file);
        
        // Show file info
        document.getElementById('selectedFileInfo').textContent = 
            `Selected: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`;
        document.getElementById('selectedFileInfo').classList.remove('hidden');
        
        // Show options panel
        document.getElementById('optionsPanel').classList.remove('hidden');
        
        // Enable convert button if plane is already selected
        const planeSelect = document.getElementById('planeSelect');
        const convertButton = document.getElementById('convertButton');
        if (planeSelect.value) {
            convertButton.disabled = false;
        }
        
        // Add change listener to plane select
        planeSelect.addEventListener('change', () => {
            convertButton.disabled = !planeSelect.value || !currentFile;
        });
        
        // Process for patterns if enabled
        const detectPatterns = document.getElementById('detectPatterns').checked;
        if (detectPatterns) {
            await detectSVGPatterns(svgContent);
        }
        
        showStatus('File loaded successfully. Configure options and select a plane.', 'info');
    } catch (error) {
        showStatus(`Error loading file: ${error.message}`, 'error');
        console.error('File loading error:', error);
    }
}

function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });
}

async function detectSVGPatterns(svgContent) {
    try {
        // Call server to detect patterns
        const response = await fetch('/api/patterns/detect', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ svgContent }),
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            detectedPatterns = data.patterns || [];
            displayPatterns(detectedPatterns);
        }
    } catch (error) {
        console.error('Pattern detection error:', error);
        // Continue without patterns
    }
}

function displayPatterns(patterns) {
    const patternList = document.getElementById('patternList');
    const patternResults = document.getElementById('patternResults');
    
    if (patterns.length === 0) {
        patternResults.classList.add('hidden');
        return;
    }
    
    patternResults.classList.remove('hidden');
    patternList.innerHTML = patterns.map((pattern, index) => `
        <div class="pattern-item">
            <label>
                <input type="checkbox" class="pattern-checkbox" data-index="${index}" checked>
                ${pattern.type}: ${pattern.count} instances → 1 array feature
                (${pattern.elementType} at ${pattern.spacing})
            </label>
        </div>
    `).join('');
}

async function loadContext() {
    const banner = document.getElementById('contextBanner');
    const elemIdEl = document.getElementById('elementId');
    
    // Show banner immediately
    banner.classList.remove('hidden');
    
    if (!documentId || !workspaceId || !elementId) {
        elemIdEl.textContent = 'Missing URL parameters';
        return;
    }
    
    try {
        console.log('Loading context for:', { documentId, workspaceId, elementId });
        const response = await fetch(
            `/api/context?documentId=${documentId}&workspaceId=${workspaceId}&elementId=${elementId}`,
            { credentials: 'include' }
        );
        
        console.log('Context response status:', response.status);
        
        if (response.ok) {
            const context = await response.json();
            console.log('Context data:', context);
            
            // Update dropdowns with current selection
            if (documentDropdown) {
                const currentDoc = { id: context.documentId, name: context.documentName };
                documentDropdown.setSelected(currentDoc);
                // Load all documents and select current
                await loadDocuments();
            }
            
            if (partStudioDropdown) {
                const currentStudio = { id: context.elementId, name: context.elementName };
                partStudioDropdown.setSelected(currentStudio);
                // Load part studios for current document
                await loadPartStudios(context.documentId);
            }
            
            elemIdEl.textContent = context.elementId ? (context.elementId.substring(0, 16) + '...') : 'Unknown';
        } else {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            console.error('Failed to load context:', response.status, errorData);
            elemIdEl.textContent = `Error: ${errorData.error || response.statusText}`;
        }
    } catch (error) {
        console.error('Error loading context:', error);
        elemIdEl.textContent = `Error: ${error.message}`;
    }
}

async function loadPlanes() {
    if (!documentId || !workspaceId || !elementId) {
        showStatus('Missing document parameters. Please open from Onshape.', 'error');
        // Still show plane selector with default planes
        showDefaultPlanes();
        return;
    }
    
    const planeSelect = document.getElementById('planeSelect');
    const planeSelector = document.getElementById('planeSelector');
    
    // Show plane selector immediately
    planeSelector.classList.remove('hidden');
    planeSelect.innerHTML = '<option value="">Loading planes...</option>';
    
    try {
        const response = await fetch(
            `/api/planes?documentId=${documentId}&workspaceId=${workspaceId}&elementId=${elementId}`,
            { credentials: 'include' }
        );
        
        if (response.ok) {
            const planes = await response.json();
            console.log('Planes response:', planes);
            
            // Handle both grouped and flat responses
            let planeList = [];
            if (planes.groups && Array.isArray(planes.groups)) {
                planeList = planes.groups.flatMap(g => g.planes || []);
            } else if (Array.isArray(planes)) {
                planeList = planes;
            } else if (planes.planes && Array.isArray(planes.planes)) {
                planeList = planes.planes;
            }
            
            if (planeList.length > 0) {
                planeSelect.innerHTML = planeList.map(plane => 
                    `<option value="${plane.id || plane.name}">${plane.name || plane.id}</option>`
                ).join('');
                console.log(`Loaded ${planeList.length} planes`);
                
                // Enable convert button if file is already selected
                if (currentFile) {
                    document.getElementById('convertButton').disabled = false;
                }
            } else {
                console.warn('No planes in response, using defaults');
                showDefaultPlanes();
            }
        } else {
            const errorData = await response.json().catch(() => ({}));
            console.error('Failed to load planes:', response.status, errorData);
            showStatus('Failed to load planes. Using default planes.', 'info');
            showDefaultPlanes();
        }
    } catch (error) {
        console.error('Plane loading error:', error);
        showStatus(`Error loading planes: ${error.message}. Using default planes.`, 'info');
        showDefaultPlanes();
    }
    
    // Always show convert button after planes are loaded (or defaulted)
    const convertButton = document.getElementById('convertButton');
    convertButton.classList.remove('hidden');
    
    // Enable button if file is already selected
    if (currentFile && planeSelect.value) {
        convertButton.disabled = false;
    }
}

function showDefaultPlanes() {
    const planeSelect = document.getElementById('planeSelect');
    const defaultPlanes = [
        { id: 'XY', name: 'Front (XY)' },
        { id: 'YZ', name: 'Right (YZ)' },
        { id: 'XZ', name: 'Top (XZ)' }
    ];
    planeSelect.innerHTML = defaultPlanes.map(plane => 
        `<option value="${plane.id}">${plane.name}</option>`
    ).join('');
    
    // Enable convert button if file is already selected
    if (currentFile) {
        document.getElementById('convertButton').disabled = false;
    }
}

async function handleConvert() {
    if (!currentFile || !svgContent) {
        showStatus('Please select an SVG file first.', 'error');
        return;
    }
    
    const planeId = document.getElementById('planeSelect').value;
    if (!planeId) {
        showStatus('Please select a target plane.', 'error');
        return;
    }
    
    if (!documentId || !workspaceId || !elementId) {
        showStatus('Missing document parameters.', 'error');
        return;
    }
    
    const convertButton = document.getElementById('convertButton');
    convertButton.disabled = true;
    convertButton.textContent = 'Converting...';
    
    try {
        // Get selected patterns
        const selectedPatterns = [];
        document.querySelectorAll('.pattern-checkbox:checked').forEach(checkbox => {
            const index = parseInt(checkbox.dataset.index);
            if (detectedPatterns[index]) {
                selectedPatterns.push(detectedPatterns[index]);
            }
        });
        
        // Create FormData for file upload
        const formData = new FormData();
        formData.append('svgFile', currentFile);
        formData.append('documentId', documentId);
        formData.append('workspaceId', workspaceId);
        formData.append('elementId', elementId);
        formData.append('planeId', planeId);
        formData.append('scale', document.getElementById('scaleFactor').value);
        formData.append('textAsSketchText', document.getElementById('textAsSketchText').checked);
        formData.append('textAsPaths', document.getElementById('textAsPaths').checked);
        formData.append('patterns', JSON.stringify(selectedPatterns));
        
        const response = await fetch('/api/convert', {
            method: 'POST',
            body: formData,
            credentials: 'include'
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            showStatus(`Success! Created sketch with ${result.elementCount} elements.`, 'success');
        } else {
            showStatus(`Conversion failed: ${result.error || 'Unknown error'}`, 'error');
        }
    } catch (error) {
        showStatus(`Error during conversion: ${error.message}`, 'error');
        console.error('Conversion error:', error);
    } finally {
        convertButton.disabled = false;
        convertButton.textContent = 'Convert to Onshape Sketch';
    }
}

function showStatus(message, type = 'info') {
    const statusMessage = document.getElementById('statusMessage');
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
    statusMessage.classList.remove('hidden');
}





