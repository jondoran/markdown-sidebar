// markdown-links-sidebar/sidebar/sidebar.js

// --- State ---
let currentMarkdown = '';
let isEditMode = false;
let topLevelTitle = ''; // Store the H1 title
let linkGroups = {}; // Object to hold parsed data: { "GroupName": [{text: "...", url: "...", rawText: "..."}, ...] }

// DOM References - will be initialized when the DOM is loaded
let sidebarTitleElement;
let groupSelector;
let linksDisplay;
let editButton;
let saveButton;
let editModeDiv;
let markdownInput;
let addTabButton;

// --- Default Content ---
const defaultMarkdown = `# My Awesome Links

## Browser Tools
- [**Marked** Test](https://marked.js.org/)
- [*Firefox* Add-ons](https://addons.mozilla.org)
- \`about:debugging\`

### Development
- [ ] Install web-ext tool
- [x] Test extension locally

## Learning
* MDN Web Docs: [JS](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
* CSS Tricks

This is a paragraph with some ==highlighted text== that demonstrates the highlight feature.

> This is a blockquote that can contain *formatted* text and [links](https://example.com).
> It can span multiple lines and is useful for emphasizing important information.

---

### Tutorials
1. First, visit the [Firefox Extension Workshop](https://extensionworkshop.com/)
2. Then, follow the getting started guide
3. Finally, build your extension

## Notes
- Remember to *save* often!
- Use \`code\` for code snippets.

### Ideas
- [ ] Add dark mode
- [ ] Support for images
- [x] Markdown formatting
`;

// --- Configure Marked (Security) ---
// Use the 'marked' global object loaded from the script
console.log("Checking if Marked library is loaded:", typeof marked);
if (typeof marked !== 'undefined') {
    console.log("Marked version:", marked.version);
    
    // Test if Marked is working correctly
    const testMarkdown = "# Test\n## Subheading\n- List item 1\n- List item 2\n### H3 Header\n- [ ] Checklist item";
    console.log("Test Markdown rendering:", marked.parse(testMarkdown));
    
    marked.setOptions({
        gfm: true, // Enable GitHub Flavored Markdown (includes strikethrough, tables slightly better)
        breaks: true, // Convert single line breaks to <br> (optional, can make lists look odd)
        sanitize: false, // DEPRECATED in newer Marked. Use sanitizer or DOMPurify if needed.
        // IMPORTANT: For basic use where YOU control the markdown, this is okay.
        // If users could potentially input arbitrary markdown from elsewhere,
        // you MUST use a sanitizer like DOMPurify *after* Marked runs.
        // Example (requires including DOMPurify library):
        // marked.setOptions({ ..., sanitizer: DOMPurify.sanitize });
        mangle: false, // Keeps email links as is
        headerIds: false // Don't add IDs to headers we generate
    });
} else {
    console.error("Marked library not loaded!");
    // Provide a fallback or disable Markdown features
    alert("Error: Markdown library failed to load. Formatting will be basic.");
}


// --- Core Functions ---

/**
 * Parses the raw Markdown string.
 * Captures the first H1 (#) as the topLevelTitle.
 * Uses H2 (##) headers to define group names.
 * Supports various markdown elements including:
 * - Headers (H1-H6)
 * - Unordered lists (* or -)
 * - Ordered lists (1. 2. etc)
 * - Checklist items (- [ ] or - [x])
 * - Horizontal rules (---, ***, ___)
 * - Blockquotes (>)
 * - Paragraphs
 */
function parseMarkdown(markdown) {
    const lines = markdown.trim().split('\n');
    const groups = {};
    let currentGroup = 'Uncategorized'; // Default group
    let foundH1 = false;
    let parsedTitle = ''; // Temporary title found during parse
    let currentHeader = null; // Track current header (H3-H6)
    let currentHeaderLevel = 0; // Track the level of the current header
    
    // For paragraph handling
    let inParagraph = false;
    let currentParagraph = '';
    
    // For blockquote handling
    let inBlockquote = false;
    let currentBlockquote = '';
    
    // Helper function to add the current paragraph to the group
    const addParagraphToGroup = () => {
        if (currentParagraph.trim()) {
            if (!groups[currentGroup]) {
                groups[currentGroup] = [];
            }
            
            groups[currentGroup].push({
                rawText: currentParagraph,
                text: currentParagraph,
                url: null,
                isParagraph: true,
                underHeader: currentHeader,
                headerLevel: currentHeaderLevel
            });
            
            currentParagraph = '';
            inParagraph = false;
        }
    };
    
    // Helper function to add the current blockquote to the group
    const addBlockquoteToGroup = () => {
        if (currentBlockquote.trim()) {
            if (!groups[currentGroup]) {
                groups[currentGroup] = [];
            }
            
            groups[currentGroup].push({
                rawText: currentBlockquote,
                text: currentBlockquote.replace(/^>\s?/gm, ''), // Remove > prefix
                url: null,
                isBlockquote: true,
                underHeader: currentHeader,
                headerLevel: currentHeaderLevel
            });
            
            currentBlockquote = '';
            inBlockquote = false;
        }
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();
        
        // Skip empty lines, but they end paragraphs and blockquotes
        if (!trimmedLine) {
            if (inParagraph) {
                addParagraphToGroup();
            }
            
            if (inBlockquote) {
                addBlockquoteToGroup();
            }
            
            continue;
        }

        // Match H1 (Top Level Title) - ONLY the first one counts
        const h1Match = trimmedLine.match(/^#\s+(?!#)(.*)/); // Starts with #, not ##
        if (h1Match && !foundH1) {
            if (inParagraph) {
                addParagraphToGroup();
            }
            
            if (inBlockquote) {
                addBlockquoteToGroup();
            }
            
            parsedTitle = h1Match[1].trim();
            foundH1 = true;
            continue;
        }

        // Match H2 (Group Headers)
        const h2Match = trimmedLine.match(/^##\s+(?!#)(.*)/);
        if (h2Match) {
            if (inParagraph) {
                addParagraphToGroup();
            }
            
            if (inBlockquote) {
                addBlockquoteToGroup();
            }
            
            currentGroup = h2Match[1].trim();
            currentHeader = null; // Reset header when we encounter a new H2
            currentHeaderLevel = 0;
            
            if (!groups[currentGroup]) {
                groups[currentGroup] = [];
            }
            continue;
        }

        // Match H3-H6 headers
        const headerMatch = trimmedLine.match(/^(#{3,6})\s+(.*)/);
        if (headerMatch) {
            if (inParagraph) {
                addParagraphToGroup();
            }
            
            if (inBlockquote) {
                addBlockquoteToGroup();
            }
            
            const level = headerMatch[1].length; // Number of # characters (3-6)
            const headerText = headerMatch[2].trim();
            
            // Add the header as a special item in the current group
            if (!groups[currentGroup]) {
                groups[currentGroup] = [];
            }
            
            currentHeader = headerText;
            currentHeaderLevel = level;
            
            groups[currentGroup].push({
                rawText: `${'#'.repeat(level)} ${headerText}`, // Keep original Markdown
                text: headerText,
                url: null,
                isHeader: true,
                headerLevel: level
            });
            continue;
        }
        
        // Match horizontal rules
        if (trimmedLine.match(/^([-*_])\1{2,}$/)) {
            if (inParagraph) {
                addParagraphToGroup();
            }
            
            if (inBlockquote) {
                addBlockquoteToGroup();
            }
            
            if (!groups[currentGroup]) {
                groups[currentGroup] = [];
            }
            
            groups[currentGroup].push({
                rawText: trimmedLine,
                text: '',
                url: null,
                isHorizontalRule: true,
                underHeader: currentHeader,
                headerLevel: currentHeaderLevel
            });
            continue;
        }
        
        // Match blockquotes
        const blockquoteMatch = trimmedLine.match(/^>\s?(.*)/);
        if (blockquoteMatch) {
            if (inParagraph) {
                addParagraphToGroup();
            }
            
            inBlockquote = true;
            currentBlockquote += (currentBlockquote ? '\n' : '') + line;
            continue;
        }

        // Match unordered list items (e.g., - Item, * Item)
        const listItemMatch = trimmedLine.match(/^(\s*)([-*])\s+(.*)/);
        if (listItemMatch) {
            if (inParagraph) {
                addParagraphToGroup();
            }
            
            if (inBlockquote) {
                addBlockquoteToGroup();
            }
            
            let leadingSpaces = listItemMatch[1].length; // Count leading spaces
            let itemText = listItemMatch[3].trim(); // Keep original markdown formatting
            let isChecklist = false;
            let isChecked = false;

            // Check if it's a checklist item
            const checklistMatch = itemText.match(/^\[([ xX])\]\s+(.*)/);
            if (checklistMatch) {
                isChecklist = true;
                isChecked = checklistMatch[1].toLowerCase() === 'x';
                itemText = checklistMatch[2].trim();
            }

            if (!groups[currentGroup]) { // Ensure group exists if list appears before first H2
               groups[currentGroup] = [];
            }

            if (itemText) { // Only add non-empty items
                // Check for link format [Text](URL) within the raw item text
                const linkMatch = itemText.match(/^\[(.+?)\]\((.+?)\)/);
                
                const item = {
                    rawText: listItemMatch[0], // Original line with bullet point
                    text: linkMatch ? linkMatch[1].trim() : itemText, // Text content
                    url: linkMatch ? linkMatch[2].trim() : null, // URL if it's a link
                    isChecklist: isChecklist,
                    isChecked: isChecked,
                    isUnorderedList: true,
                    underHeader: currentHeader,
                    headerLevel: currentHeaderLevel,
                    nestingLevel: leadingSpaces / 2 // Assuming 2 spaces per level of indentation
                };
                
                groups[currentGroup].push(item);
            }
            continue;
        }
        
        // Match ordered list items (e.g., 1. Item, 2. Item)
        const orderedListMatch = trimmedLine.match(/^(\s*)(\d+)\.\s+(.*)/);
        if (orderedListMatch) {
            if (inParagraph) {
                addParagraphToGroup();
            }
            
            if (inBlockquote) {
                addBlockquoteToGroup();
            }
            
            const leadingSpaces = orderedListMatch[1].length; // Count leading spaces
            const number = parseInt(orderedListMatch[2]);
            const itemText = orderedListMatch[3].trim();


            if (itemText) { // Only add non-empty items
                // Check for link format [Text](URL) within the raw item text
                const linkMatch = itemText.match(/^\[(.+?)\]\((.+?)\)/);
                
                const item = {
                    rawText: orderedListMatch[0], // Original line with number
                    text: linkMatch ? linkMatch[1].trim() : itemText, // Text content
                    url: linkMatch ? linkMatch[2].trim() : null, // URL if it's a link
                    isOrderedList: true,
                    number: number,
                    underHeader: currentHeader,
                    headerLevel: currentHeaderLevel
                };
                
                groups[currentGroup].push(item);
            }
            continue;
        }
        
        // If we get here, it's a paragraph text
        if (inBlockquote) {
            // If we're in a blockquote, continue collecting lines
            currentBlockquote += '\n' + line;
        } else {
            // Otherwise, it's a regular paragraph
            if (!inParagraph) {
                inParagraph = true;
                currentParagraph = line;
            } else {
                currentParagraph += '\n' + line;
            }
        }
    }
    
    // Handle any remaining paragraph or blockquote
    if (inParagraph) {
        addParagraphToGroup();
    }
    
    if (inBlockquote) {
        addBlockquoteToGroup();
    }

    // Return both the title and the groups
    return { title: parsedTitle, groups: groups };
}


/**
 * Renders the main sidebar title (H1).
 */
function renderSidebarTitle() {
    if (topLevelTitle) {
        sidebarTitleElement.textContent = topLevelTitle;
        sidebarTitleElement.style.display = 'block'; // Show the title element
    } else {
        sidebarTitleElement.textContent = '';
        sidebarTitleElement.style.display = 'none'; // Hide if no title
    }
}


/**
 * Renders the group selector dropdown (using H2s).
 */
function renderGroupSelector() {
    groupSelector.innerHTML = ''; // Clear existing options
    const groupNames = Object.keys(linkGroups);

    if (groupNames.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No Groups Found';
        groupSelector.appendChild(option);
        groupSelector.disabled = true;
        return;
    }

    groupSelector.disabled = false;
    groupNames.forEach(groupName => {
        const option = document.createElement('option');
        option.value = groupName;
        option.textContent = groupName;
        groupSelector.appendChild(option);
    });

    const lastSelected = groupSelector.dataset.lastSelected;
    if (lastSelected && groupNames.includes(lastSelected)) {
        groupSelector.value = lastSelected;
    } else if (groupNames.length > 0) {
         // Select the first group if no previous selection or previous is gone
         groupSelector.value = groupNames[0];
    }
}


/**
 * Renders the links/notes for the currently selected group, using Marked for formatting.
 */
function renderLinks(groupName) {
    linksDisplay.innerHTML = ''; // Clear previous links
    const items = linkGroups[groupName] || [];
    
    if (items.length === 0) {
        const emptyMessage = document.createElement('p');
        emptyMessage.innerHTML = '<em>No items in this group.</em>';
        linksDisplay.appendChild(emptyMessage);
        return;
    }
    
    // Collect all markdown content for this group
    let groupContent = '';
    
    // Process all items in their original order
    items.forEach(item => {
        // Special handling for headers (H3-H6)
        if (item.isHeader) {
            const level = item.headerLevel || 3; // Default to H3 if not specified
            groupContent += `${'#'.repeat(level)} ${item.text}\n\n`;
            return;
        }
        
        // Handle horizontal rules
        if (item.isHorizontalRule) {
            groupContent += '---\n\n';
            return;
        }
        
        // Handle blockquotes
        if (item.isBlockquote) {
            groupContent += `${item.rawText}\n\n`;
            return;
        }
        
        // Handle paragraphs
        if (item.isParagraph) {
            groupContent += `${item.text}\n\n`;
            return;
        }
        
        // Handle ordered lists
        if (item.isOrderedList) {
            // Check if this is a link
            if (item.url) {
                groupContent += `${item.number}. [${item.text}](${item.url})\n`;
            } else {
                groupContent += `${item.number}. ${item.text}\n`;
            }
            return;
        }
        
        // Handle unordered lists
        if (item.isChecklist) {
            const checkMark = item.isChecked ? 'x' : ' ';
            const indent = item.nestingLevel > 0 ? '  '.repeat(item.nestingLevel) : '';
            
            if (item.url) {
                groupContent += `${indent}- [${checkMark}] [${item.text}](${item.url})\n`;
            } else {
                groupContent += `${indent}- [${checkMark}] ${item.text}\n`;
            }
        } else {
            // Regular unordered list item
            const indent = item.nestingLevel > 0 ? '  '.repeat(item.nestingLevel) : '';
            
            if (item.url) {
                groupContent += `${indent}- [${item.text}](${item.url})\n`;
            } else {
                groupContent += `${indent}- ${item.text}\n`;
            }
        }
    });
    
    // Use Marked to render the entire group content
    if (typeof marked !== 'undefined') {
        try {
            // Render the markdown content
            linksDisplay.innerHTML = marked.parse(groupContent);
            
            // Handle highlighted text (==text==)
            const html = linksDisplay.innerHTML;
            linksDisplay.innerHTML = html.replace(/==(.+?)==/g, '<mark>$1</mark>');
            
            // Make sure all links open in a new tab
            const links = linksDisplay.querySelectorAll('a');
            links.forEach(link => {
                link.target = "_blank";
                link.rel = "noopener noreferrer";
            });
            
            // Process checkbox items to remove bullets and add strikethrough for checked items
            const checkboxItems = linksDisplay.querySelectorAll('input[type="checkbox"]');
            checkboxItems.forEach((checkbox, index) => {
                // Find the parent li element
                const listItem = checkbox.closest('li');
                if (listItem) {
                    // Add task-list-item class to remove bullets
                    listItem.classList.add('task-list-item');
                    
                    // Apply strikethrough if checked
                    if (checkbox.checked) {
                        listItem.classList.add('checked');
                    }
                    
                    // Add event listener for checkbox changes
                    checkbox.addEventListener('change', () => {
                        // Find the corresponding item in the items array
                        const checklistItems = items.filter(item => item.isChecklist);
                        const item = checklistItems[index];
                        
                        if (item) {
                            // Update the item's isChecked state
                            item.isChecked = checkbox.checked;
                            
                            // Update the raw text to reflect the new state
                            const checkMark = checkbox.checked ? 'x' : ' ';
                            item.rawText = item.rawText.replace(/\[([ xX])\]/, `[${checkMark}]`);
                            
                            // Apply or remove strikethrough based on checkbox state
                            if (checkbox.checked) {
                                listItem.classList.add('checked');
                            } else {
                                listItem.classList.remove('checked');
                            }
                            
                            // Update the stored markdown content
                            const lines = currentMarkdown.split('\n');
                            for (let i = 0; i < lines.length; i++) {
                                const line = lines[i].trim();
                                if (line.includes(item.text) && line.includes('- [')) {
                                    lines[i] = lines[i].replace(/\[([ xX])\]/, `[${checkMark}]`);
                                    break;
                                }
                            }
                            currentMarkdown = lines.join('\n');
                            
                            // Save the updated markdown to storage
                            browser.storage.local.set({ markdownContent: currentMarkdown })
                                .then(() => console.log('Checkbox state saved'))
                                .catch(error => console.error('Error saving checkbox state:', error));
                        }
                    });
                }
            });
        } catch (error) {
            console.error('Error rendering markdown:', error);
            linksDisplay.innerHTML = '<p>Error rendering content. See console for details.</p>';
        }
    } else {
        // Fallback if marked is not available
        linksDisplay.innerHTML = '<p>Markdown rendering is not available.</p>';
    }
    
    groupSelector.dataset.lastSelected = groupName;
}

// Helper to escape HTML for basic fallback
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#39;");
 }


/**
 * Switches between View Mode and Edit Mode.
 */
function toggleEditMode(edit) {
    isEditMode = edit;
    if (isEditMode) {
        markdownInput.value = currentMarkdown;
        linksDisplay.style.display = 'none';
        editModeDiv.style.display = 'flex';
        editButton.style.display = 'none';
        saveButton.style.display = 'inline-block';
        groupSelector.disabled = true;
        sidebarTitleElement.style.display = 'none'; // Hide title in edit mode
        markdownInput.focus();
    } else {
        // View Mode (after potential save)
        editModeDiv.style.display = 'none';
        linksDisplay.style.display = 'block';
        saveButton.style.display = 'none';
        editButton.style.display = 'inline-block';
        groupSelector.disabled = false;

        // Re-parse and re-render the view
        const parsedData = parseMarkdown(currentMarkdown);
        topLevelTitle = parsedData.title;
        linkGroups = parsedData.groups;

        renderSidebarTitle(); // Render title first
        renderGroupSelector(); // Then groups

        // Render links for the selected (or first) group
        const selectedGroup = groupSelector.value;
         if (selectedGroup) {
            renderLinks(selectedGroup);
         } else if (Object.keys(linkGroups).length > 0) {
            // If no specific selection but groups exist, render the first one
             renderLinks(Object.keys(linkGroups)[0]);
         }
         else {
             // No groups found at all
             linksDisplay.innerHTML = '<ul><li><em>No content found. Try editing!</em></li></ul>';
         }
    }
}


/**
 * Saves the Markdown content from the textarea to browser storage.
 */
async function saveMarkdown() {
    currentMarkdown = markdownInput.value;
    try {
        await browser.storage.local.set({ markdownContent: currentMarkdown });
        console.log('Markdown saved successfully.');
        toggleEditMode(false); // Switch back to view mode after saving
    } catch (error) {
        console.error('Error saving markdown:', error);
        alert('Error saving changes. See browser console for details.');
    }
}

/**
 * Gets the active tab's information and adds it to the current markdown content.
 */
async function addCurrentTab() {
    try {
        // Get the active tab in the current window
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        
        if (tabs.length === 0) {
            console.error('No active tab found');
            alert('Could not find an active tab.');
            return;
        }
        
        const activeTab = tabs[0];
        const title = activeTab.title || 'Untitled Page';
        const url = activeTab.url;
        
        console.log('Active tab:', { title, url });
        
        // Get the currently selected group
        const selectedGroup = groupSelector.value;
        if (!selectedGroup) {
            console.error('No group selected');
            alert('Please select a group first.');
            return;
        }
        
        // Create a new markdown link entry
        const newLink = `- [${title}](${url})`;
        
        // Add the new link to the markdown content
        const lines = currentMarkdown.split('\n');
        let groupFound = false;
        let lastGroupLineIndex = -1;
        
        // Find the selected group and the last line of its content
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Check if this line is the selected group header
            if (line.match(new RegExp(`^##\\s+${selectedGroup}\\s*$`))) {
                groupFound = true;
                lastGroupLineIndex = i;
                
                // Find the last line of this group's content
                for (let j = i + 1; j < lines.length; j++) {
                    const nextLine = lines[j].trim();
                    
                    // If we find another group header, stop
                    if (nextLine.match(/^##\s+/)) {
                        break;
                    }
                    
                    lastGroupLineIndex = j;
                }
                
                break;
            }
        }
        
        if (!groupFound) {
            console.error('Selected group not found in markdown');
            alert(`Could not find the selected group "${selectedGroup}" in the markdown content.`);
            return;
        }
        
        // Insert the new link after the last line of the group
        lines.splice(lastGroupLineIndex + 1, 0, newLink);
        
        // Update the markdown content
        currentMarkdown = lines.join('\n');
        
        // Save the updated markdown
        await browser.storage.local.set({ markdownContent: currentMarkdown });
        console.log('Tab added successfully');
        
        // Re-parse and re-render the view
        const parsedData = parseMarkdown(currentMarkdown);
        topLevelTitle = parsedData.title;
        linkGroups = parsedData.groups;
        
        renderSidebarTitle();
        renderGroupSelector();
        
        // Make sure the same group is still selected
        groupSelector.value = selectedGroup;
        renderLinks(selectedGroup);
        
        // Show a brief success message
        const successMessage = document.createElement('div');
        successMessage.textContent = 'Tab added!';
        successMessage.style.position = 'absolute';
        successMessage.style.bottom = '10px';
        successMessage.style.right = '10px';
        successMessage.style.backgroundColor = 'var(--firefox-blue)';
        successMessage.style.color = 'white';
        successMessage.style.padding = '5px 10px';
        successMessage.style.borderRadius = '3px';
        successMessage.style.opacity = '0.9';
        document.body.appendChild(successMessage);
        
        // Remove the message after 2 seconds
        setTimeout(() => {
            successMessage.style.opacity = '0';
            successMessage.style.transition = 'opacity 0.5s';
            setTimeout(() => {
                document.body.removeChild(successMessage);
            }, 500);
        }, 2000);
        
    } catch (error) {
        console.error('Error adding current tab:', error);
        alert('Error adding current tab. See browser console for details.');
    }
}

/**
 * Loads Markdown content from browser storage or uses default.
 */
async function loadMarkdown() {
    try {
        const result = await browser.storage.local.get('markdownContent');
        if (result && typeof result.markdownContent === 'string') { // Check if key exists and is string
            currentMarkdown = result.markdownContent;
            console.log('Markdown loaded from storage.');
        } else {
            currentMarkdown = defaultMarkdown;
            console.log('No markdown found in storage or invalid format, using default.');
            // Save the default content back to storage
            await browser.storage.local.set({ markdownContent: currentMarkdown });
        }
    } catch (error) {
        console.error('Error loading markdown:', error);
        currentMarkdown = defaultMarkdown; // Fallback to default on error
         alert('Error loading saved links. Using default content. See browser console for details.');
    } finally {
        // Parse the loaded/default markdown
        const parsedData = parseMarkdown(currentMarkdown);
        topLevelTitle = parsedData.title;
        linkGroups = parsedData.groups;

        // Initial render
        renderSidebarTitle();
        renderGroupSelector();
        const initialGroup = groupSelector.value; // Get the selected value after renderGroupSelector
         if (initialGroup) {
            renderLinks(initialGroup);
         } else if (Object.keys(linkGroups).length > 0) {
             // If no selection but groups exist (e.g. "Uncategorized"), render first
             renderLinks(Object.keys(linkGroups)[0]);
         }
         else {
             linksDisplay.innerHTML = '<ul><li><em>No content found. Try editing!</em></li></ul>';
         }
    }
}


// --- Event Listeners are now added in the DOMContentLoaded handler ---

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded event fired');
    
    // Initialize DOM references
    sidebarTitleElement = document.getElementById('sidebar-title');
    groupSelector = document.getElementById('group-selector');
    linksDisplay = document.getElementById('links-display');
    editButton = document.getElementById('edit-button');
    saveButton = document.getElementById('save-button');
    editModeDiv = document.getElementById('edit-mode');
    markdownInput = document.getElementById('markdown-input');
    addTabButton = document.getElementById('add-tab-button');
    
    // Log DOM elements to verify they're found
    console.log('DOM Elements:', {
        sidebarTitleElement,
        groupSelector,
        linksDisplay,
        editButton,
        saveButton,
        editModeDiv,
        markdownInput,
        addTabButton
    });
    
    // Check if browser API is available
    if (typeof browser === 'undefined') {
        console.error('browser API is not available. This extension requires Firefox.');
        // Fallback to chrome API if available (for Chrome compatibility)
        if (typeof chrome !== 'undefined' && chrome.storage) {
            console.log('Using chrome API as fallback');
            window.browser = chrome;
        } else {
            console.error('No compatible browser API found');
            alert('This extension requires Firefox or a compatible browser with the WebExtensions API.');
            return;
        }
    }
    
    // Check if storage API is available
    if (!browser.storage || !browser.storage.local) {
        console.error('browser.storage.local API is not available');
        alert('This extension requires the storage permission to function properly.');
        return;
    }
    
    // Add event listeners
    groupSelector.addEventListener('change', (event) => {
        console.log('Group selector changed:', event.target.value);
        renderLinks(event.target.value);
    });
    
    editButton.addEventListener('click', () => {
        console.log('Edit button clicked');
        toggleEditMode(true);
    });
    
    saveButton.addEventListener('click', () => {
        console.log('Save button clicked');
        saveMarkdown();
    });
    
    addTabButton.addEventListener('click', () => {
        console.log('Add Tab button clicked');
        addCurrentTab();
    });
    
    // Initialize the extension
    loadMarkdown().catch(error => {
        console.error('Error during initialization:', error);
        alert('Error initializing the extension. See browser console for details.');
    });
});

// Add a global error handler
window.addEventListener('error', (event) => {
    console.error('Uncaught error:', event.error);
});
