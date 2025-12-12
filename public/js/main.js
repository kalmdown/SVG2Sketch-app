/**
 * Main client-side JavaScript for SVG2Sketch app
 */

// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const documentId = urlParams.get('documentId');
const workspaceId = urlParams.get('workspaceId');
const elementId = urlParams.get('elementId');

// State
let currentFile = null;
let svgContent = null;
let detectedPatterns = [];

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    loadPlanes();
});

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

async function loadPlanes() {
    if (!documentId || !workspaceId || !elementId) {
        showStatus('Missing document parameters. Please open from Onshape.', 'error');
        return;
    }
    
    try {
        const response = await fetch(
            `/api/planes?documentId=${documentId}&workspaceId=${workspaceId}&elementId=${elementId}`,
            { credentials: 'include' }
        );
        
        if (response.ok) {
            const planes = await response.json();
            const planeSelect = document.getElementById('planeSelect');
            const planeSelector = document.getElementById('planeSelector');
            
            // Handle both grouped and flat responses
            const planeList = planes.groups ? 
                planes.groups.flatMap(g => g.planes) : 
                planes;
            
            planeSelect.innerHTML = planeList.map(plane => 
                `<option value="${plane.id}">${plane.name}</option>`
            ).join('');
            
            planeSelector.classList.remove('hidden');
            document.getElementById('convertButton').classList.remove('hidden');
        } else {
            showStatus('Failed to load planes.', 'error');
        }
    } catch (error) {
        showStatus(`Error loading planes: ${error.message}`, 'error');
        console.error('Plane loading error:', error);
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





