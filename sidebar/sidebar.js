// markdown-links-sidebar/sidebar.js

// --- State ---
let currentMarkdown = '';
let isEditMode = false;
let topLevelTitle = ''; // Store the H1 title
let linkGroups = {};

// DOM References - will be initialized when the DOM is loaded
let sidebarTitleElement;
let groupSelector;
let linksDisplay;
let editButton;
let saveButton;
let editModeDiv;
let markdownInput;
let addTabButton;

// Inside sidebar.js

// --- Default Content ---
const defaultMarkdown = `# My Sidebar

## Life Admin

Organizing personal tasks and information.

### Quick Links

- [My Bank](https://example.com/login)
- [Utility Provider](https://example.com/myaccount)
- *[Council Website](https://example.gov.au)*

### Tasks

- [x] Pay electricity bill
- [ ] Renew car registration
- [ ] Book dentist appointment
  - [ ] Check calendar availability
  - [ ] Call clinic

> **Note:** Remember to check mail for the renewal notice first.

## Work

Professional tasks, links, and code snippets.

* Company Intranet: [Link](https://internal.example.com)
* Project Tracker: [Board](https://tracker.example.com)

### Code Snippets

Useful commands or examples:

\`\`\`bash
# Update dependencies
npm update

# Run local server
npm run dev
\`\`\`

\`\`\`python
def hello(name):
  print(f"Hello, {name}!")

hello("World")
\`\`\`

## Active Projects

Current personal or side projects.

### Project Alpha (Website)

1.  Design mockups: [Figma Link](https://figma.com/...)
2.  Develop frontend:
    * Setup base structure
    * Implement navigation
3.  Backend API integration.
- **Reference:** [MDN Web Docs](https://developer.mozilla.org/)

### Learning Japanese

- Vocabulary App: [Link](https://jp-app.example.com)
- Grammar Guide: [Tae Kim's Guide](http://www.guidetojapanese.org/learn/)
- [ ] Practice Kanji daily
- [x] Complete Chapter 3 exercises

## Hobbies

Links and notes related to personal interests.

### Photography

- Inspiration: [Unsplash](https://unsplash.com/)
- Gear Wishlist:
  - New prime lens
  - Sturdier tripod

### Reading List

* *Infinite Jest* by David Foster Wallace
* *The Unconsoled* by Kazuo Ishiguro

`;

// --- Configure Marked ---
console.log("Checking if Marked library is loaded:", typeof marked);
if (typeof marked !== 'undefined') {
    console.log("Marked version:", marked.version);
    marked.setOptions({
        gfm: true,
        breaks: true, // Consider if you still want this with better list handling
        sanitize: false, // Keep false, but remember the sanitizer recommendation for production
        mangle: false,
        headerIds: false
    });
} else {
    console.error("Marked library not loaded!");
    alert("Error: Markdown library failed to load. Formatting will be basic.");
}


// --- Core Functions ---

/**
 * Uses marked.lexer to get tokens and groups them by H2 headers.
 * Captures the first H1 token as the topLevelTitle.
 */
function lexAndGroupMarkdown(markdown) {
    const tokens = marked.lexer(markdown.trim());
    const groups = {};
    let currentGroup = 'Uncategorized'; // Default group
    let currentGroupTokens = [];
    let foundH1 = false;
    let parsedTitle = '';

    // Find H1 first
    const firstH1Index = tokens.findIndex(token => token.type === 'heading' && token.depth === 1);
    if (firstH1Index !== -1) {
        parsedTitle = tokens[firstH1Index].text;
        foundH1 = true;
        // Remove the H1 token from the main list to avoid it appearing in groups
        tokens.splice(firstH1Index, 1);
    }

    tokens.forEach(token => {
        if (token.type === 'heading' && token.depth === 2) {
            // Save the previous group's tokens
            if (currentGroup !== 'Uncategorized' || currentGroupTokens.length > 0) {
                groups[currentGroup] = currentGroupTokens;
            }
            // Start a new group
            currentGroup = token.text;
            currentGroupTokens = []; // Reset tokens for the new group
        } else {
            // Add token to the current group
            currentGroupTokens.push(token);
        }
    });

    // Add the last group
    if (currentGroup !== 'Uncategorized' || currentGroupTokens.length > 0) {
         groups[currentGroup] = currentGroupTokens;
    }

    // If no H2s were found, but content exists, keep it in Uncategorized
     if (Object.keys(groups).length === 0 && currentGroupTokens.length > 0) {
          groups['Uncategorized'] = currentGroupTokens;
     }

    return { title: parsedTitle, groups: groups };
}


/**
 * Renders the main sidebar title (H1).
 */
function renderSidebarTitle() {
    if (topLevelTitle) {
        sidebarTitleElement.textContent = topLevelTitle;
        sidebarTitleElement.style.display = 'block';
    } else {
        sidebarTitleElement.textContent = '';
        sidebarTitleElement.style.display = 'none';
    }
}


/**
 * Renders the group selector dropdown (using H2s).
 */
function renderGroupSelector() {
    const currentSelected = groupSelector.value; // Store current selection
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

    // Try to restore previous selection, otherwise select the first
    if (currentSelected && groupNames.includes(currentSelected)) {
        groupSelector.value = currentSelected;
    } else if (groupNames.length > 0) {
         groupSelector.value = groupNames[0];
    }
     // Store the current value for persistence across renders
     groupSelector.dataset.lastSelected = groupSelector.value;
}

/**
 * Renders the links/notes for the currently selected group using marked.parser.
 */
function renderLinks(groupName) {
    linksDisplay.innerHTML = ''; // Clear previous links
    const tokens = linkGroups[groupName] || [];

    if (tokens.length === 0) {
        const emptyMessage = document.createElement('p');
        emptyMessage.innerHTML = '<em>No items in this group.</em>';
        linksDisplay.appendChild(emptyMessage);
        return;
    }

    // Use Marked to render the tokens for this group
    if (typeof marked !== 'undefined') {
        try {
            // Prepare the tokens list for the parser
            const parserTokens = [...tokens];
            parserTokens.links = tokens.links || {}; // Required by marked.parser()

            // Generate HTML from tokens
            const rawHtml = marked.parser(parserTokens); // Get HTML string

            // Sanitize the HTML generated by marked
            const sanitizedHtml = DOMPurify.sanitize(rawHtml);

            // Set the sanitized HTML
            linksDisplay.innerHTML = sanitizedHtml; // Use the sanitized version

            // --- Post-processing on the *already sanitized* content ---

            // 1. Handle highlighted text (==text==) - Apply AFTER initial sanitization
            //    (Note: This specific pattern is likely safe, but be cautious
            //     if manipulating the structure after sanitization)
            const processedHtml = linksDisplay.innerHTML.replace(/==(.+?)==/g, '<mark>$1</mark>');
            linksDisplay.innerHTML = processedHtml; // Re-assigning here is okay as <mark> is generally safe

            // 2. Make sure all links open in a new tab (do this on the sanitized content)
            const links = linksDisplay.querySelectorAll('a');
            links.forEach(link => {
                link.target = "_blank";
                link.rel = "noopener noreferrer"; // Good practice for security/privacy
            });

            // 3. Process checkboxes: add class, remove 'disabled', add listener
            const checkboxInputs = linksDisplay.querySelectorAll('input[type="checkbox"]');
            checkboxInputs.forEach(checkbox => {
                const listItem = checkbox.closest('li');
                if (listItem) {
                    listItem.classList.add('task-list-item');
                    checkbox.disabled = false;
                    if (checkbox.checked) {
                        listItem.classList.add('checked');
                    } else {
                         listItem.classList.remove('checked');
                    }
                    // Ensure listener isn't duplicated on potential re-renders
                    checkbox.removeEventListener('change', handleCheckboxChange);
                    checkbox.addEventListener('change', (event) => handleCheckboxChange(event.target, listItem, groupName));
                } else {
                    console.warn("Found checkbox without parent <li>:", checkbox);
                }
            });

        } catch (error) {
            console.error(`Error rendering markdown for group "${groupName}":`, error);
            linksDisplay.innerHTML = '<p>Error rendering content. See console for details.</p>';
        }
    } else {
        linksDisplay.innerHTML = '<p>Markdown rendering is not available.</p>';
    }

    groupSelector.dataset.lastSelected = groupName;
}

// NOTE: Ensure the handleCheckboxChange and findMarkdownLineForCheckbox functions
// (with their logging) from the previous steps are still present in your sidebar.js

/**
 * Finds the specific line index in the raw markdown for a given checkbox list item.
 */
function findMarkdownLineForCheckbox(listItemElement, groupName, currentMarkdown) {
    // 1. Extract text from the list item
    let searchtextContent = '';
    const tempLi = listItemElement.cloneNode(true);
    const checkboxInTemp = tempLi.querySelector('input[type="checkbox"]');
    if (checkboxInTemp) {
        checkboxInTemp.remove();
    }
    searchtextContent = tempLi.textContent.trim().replace(/\s+/g, ' ');
    console.log(`[findMarkdownLine] Searching for group "${groupName}" with text: "${searchtextContent}"`); // Log search details

    if (!searchtextContent) {
        console.warn("[findMarkdownLine] Could not extract searchable text content for list item:", listItemElement);
        return -1;
    }

    // 2. Search within the raw markdown lines
    const lines = currentMarkdown.split('\n');
    let inSelectedGroup = false;
    let groupStartLine = -1;
    let potentialMatchIndex = -1;
    let isNested = (listItemElement.closest('ul ul, ol ol, ul ol, ol ul') !== null); // Check if the item is nested
    console.log(`[findMarkdownLine] Is item nested? ${isNested}`);

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();
        const h2Match = trimmedLine.match(/^##\s+(.*)/);

        // Find group boundaries
        if (h2Match) {
            if (inSelectedGroup) {
                 console.log(`[findMarkdownLine] Reached next group header at line ${i}, stopping search in "${groupName}".`);
                 break; // Found next group
            }
            if (h2Match[1].trim() === groupName) {
                console.log(`[findMarkdownLine] Entered group "${groupName}" at line ${i}.`);
                inSelectedGroup = true;
                groupStartLine = i;
            }
        } else if (inSelectedGroup) {
            // Inside the correct group
            const checklistRegex = /^\s*([-*])\s+\[([ xX])\]\s+(.*)/;
            const match = line.match(checklistRegex);

            if (match) {
                const rawTextPart = match[3].trim().replace(/\s+/g, ' ');
                console.log(`[findMarkdownLine] Checking line ${i}: Raw text part: "${rawTextPart}"`); // Log comparison details
                // Try a more flexible comparison
                if (rawTextPart.includes(searchtextContent) || searchtextContent.includes(rawTextPart) || rawTextPart === searchtextContent) {
                    potentialMatchIndex = i;
                    console.log(`[findMarkdownLine] Found potential match at line ${i}.`);
                    break; // Assume first match is correct
                }
            }
        }
    }

    // Handle 'Uncategorized' group
     if (!inSelectedGroup && groupName === 'Uncategorized') {
          console.log(`[findMarkdownLine] Searching in "Uncategorized" group.`);
          let firstH2Index = lines.findIndex(l => l.trim().startsWith('## '));
          if (firstH2Index === -1) firstH2Index = lines.length;

          for (let i = 0; i < firstH2Index; i++) {
             const line = lines[i];
             const checklistRegex = /^\s*([-*])\s+\[([ xX])\]\s+(.*)/;
             const match = line.match(checklistRegex);
             if (match) {
                  const rawTextPart = match[3].trim().replace(/\s+/g, ' ');
                   console.log(`[findMarkdownLine] Checking line ${i} (Uncategorized): Raw text part: "${rawTextPart}"`);
                  if (rawTextPart.includes(searchtextContent) || searchtextContent.includes(rawTextPart) || rawTextPart === searchtextContent) {
                      potentialMatchIndex = i;
                       console.log(`[findMarkdownLine] Found potential match at line ${i} (Uncategorized).`);
                      break;
                  }
             }
          }
     }

    if (potentialMatchIndex === -1) {
         console.log(`[findMarkdownLine] No matching line found for "${searchtextContent}" in group "${groupName}".`);
    }
    return potentialMatchIndex;
}

/**
 * Handles checkbox state changes: updates the raw markdown and saves.
 */
async function handleCheckboxChange(checkbox, listItem, groupName) {
    const isChecked = checkbox.checked;
    console.log(`Checkbox change detected. Checked: ${isChecked}. Item:`, listItem.textContent.trim()); // Log initial state

    // Apply/remove visual strikethrough immediately
    if (isChecked) {
        listItem.classList.add('checked');
        console.log('Added .checked class');
    } else {
        // *** Explicitly remove the class ***
        listItem.classList.remove('checked');
        console.log('Removed .checked class'); // Log removal
    }

     // Verify class removal immediately after
     console.log('Class list after update:', listItem.classList.toString());


    // Find the corresponding markdown line index
    const lineIndex = findMarkdownLineForCheckbox(listItem, groupName, currentMarkdown);

    if (lineIndex !== -1) {
        try {
            const lines = currentMarkdown.split('\n');
            const checkMark = isChecked ? 'x' : ' ';
            // Replace the checkbox marker in the found line
            const oldLine = lines[lineIndex];
            lines[lineIndex] = oldLine.replace(/\[([ xX])\]/, `[${checkMark}]`);
            currentMarkdown = lines.join('\n');
            console.log(`Updated markdown line ${lineIndex}: "${oldLine}" -> "${lines[lineIndex]}"`);

            // Save the updated markdown to storage
            await browser.storage.local.set({ markdownContent: currentMarkdown });
            console.log('Checkbox state saved successfully.');

        } catch (error) {
             console.error('Error updating/saving checkbox state in markdown:', error);
             alert("Error saving checkbox state. See console.");
             // Revert visual change on error
             checkbox.checked = !isChecked; // Toggle back
             console.log(`Save error, reverting visual state. Checked: ${checkbox.checked}`);
             if(isChecked) {
                 listItem.classList.remove('checked'); // Ensure removed on error during check
                 console.log('Save error, ensured .checked class removed');
             } else {
                 listItem.classList.add('checked'); // Ensure added on error during uncheck
                  console.log('Save error, ensured .checked class added back');
             }
             console.log('Class list after save error:', listItem.classList.toString());
        }
    } else {
        console.error('Could not find corresponding markdown line for checkbox:', listItem.textContent.trim());
        alert("Error saving checkbox state. Could not find the item in the source Markdown.");
        // Revert visual change if line not found
         checkbox.checked = !isChecked; // Toggle back
         console.log(`Line not found, reverting visual state. Checked: ${checkbox.checked}`);
         if(isChecked) {
             listItem.classList.remove('checked');
              console.log('Line not found, ensured .checked class removed');
         } else {
             listItem.classList.add('checked');
             console.log('Line not found, ensured .checked class added back');
         }
         console.log('Class list after line not found error:', listItem.classList.toString());
    }
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

        // Re-lex/group and re-render the view
        const parsedData = lexAndGroupMarkdown(currentMarkdown);
        topLevelTitle = parsedData.title;
        linkGroups = parsedData.groups;

        renderSidebarTitle();
        renderGroupSelector(); // Renders dropdown and sets initial selection

        const selectedGroup = groupSelector.value;
        if (selectedGroup) {
            renderLinks(selectedGroup);
        } else {
            // Handle case where there might be no groups after edit
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
 * Escapes HTML special characters in a string.
 */
function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

/**
 * Gets the active tab's information and adds it to the current markdown content.
 */
async function addCurrentTab() {
    try {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        if (tabs.length === 0) {
            console.error('No active tab found');
            alert('Could not find an active tab.');
            return;
        }
        const activeTab = tabs[0];
        // Sanitize title slightly: remove potential square brackets to avoid breaking markdown link syntax
        const title = escapeHtml((activeTab.title || 'Untitled Page').replace(/[[\]]/g, '')); // Escaped title
        const url = activeTab.url;

        if (!url || url.startsWith('about:')) {
             alert('Cannot add special browser pages (like about:debugging).');
             return;
        }

        const selectedGroup = groupSelector.value;
        if (!selectedGroup) {
            alert('Please select a group first.');
            return;
        }

        const newLink = `- [${title}](${url})`;
        const lines = currentMarkdown.split('\n');
        let groupFound = false;
        let insertIndex = -1;

        // Find the line *after* the selected group header or the end of the file
        let inSelectedGroup = false;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            const h2Match = line.match(/^##\s+(.*)/);

            if (h2Match && h2Match[1].trim() === selectedGroup) {
                groupFound = true;
                inSelectedGroup = true;
                insertIndex = i + 1; // Default: insert right after header
            } else if (inSelectedGroup) {
                if (line.match(/^##\s+/)) {
                    // Found the next group header, insert before it
                    insertIndex = i;
                    break;
                } else {
                    // Keep track of the last line within the current group
                    insertIndex = i + 1;
                }
            }
        }

        // Handle 'Uncategorized' - insert after H1 if exists, else at start, before first H2
        if (!groupFound && selectedGroup === 'Uncategorized') {
             groupFound = true; // Assume it exists implicitly
             let firstH2Index = lines.findIndex(line => line.trim().startsWith('## '));
             if (firstH2Index === -1) firstH2Index = lines.length; // No H2s, append to end

             let firstH1Index = lines.findIndex(line => line.trim().startsWith('# '));
             insertIndex = (firstH1Index !== -1) ? firstH1Index + 1 : 0; // After H1 or at start
             // Ensure we insert before the first H2 if H1 isn't present or is after H2 (unlikely)
             if(insertIndex >= firstH2Index) {
                 insertIndex = firstH2Index;
             }

        } else if (!groupFound) {
            console.error('Selected group not found in markdown for adding tab');
            alert(`Could not find the selected group "${selectedGroup}" to add the tab.`);
            return;
        }

        // Ensure insertion index is valid
        if (insertIndex < 0) insertIndex = lines.length; // Append if something went wrong

        // Add an empty line before the new link if the preceding line isn't empty
        if (insertIndex > 0 && lines[insertIndex - 1] && lines[insertIndex - 1].trim() !== '') {
             lines.splice(insertIndex, 0, ''); // Insert blank line
             insertIndex++;
        }


        lines.splice(insertIndex, 0, newLink);
        currentMarkdown = lines.join('\n');

        // Save, re-lex, re-render
        await browser.storage.local.set({ markdownContent: currentMarkdown });
        console.log('Tab added successfully');

        const parsedData = lexAndGroupMarkdown(currentMarkdown);
        topLevelTitle = parsedData.title;
        linkGroups = parsedData.groups;

        renderSidebarTitle();
        renderGroupSelector(); // Re-render dropdown

        // Restore selection and render links
        groupSelector.value = selectedGroup; // Ensure correct group is selected
        renderLinks(selectedGroup); // Render the updated group

        // Optional: Show brief success message (implement as needed)


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
        if (result && typeof result.markdownContent === 'string') {
            currentMarkdown = result.markdownContent;
        } else {
            currentMarkdown = defaultMarkdown;
            await browser.storage.local.set({ markdownContent: currentMarkdown });
        }
    } catch (error) {
        console.error('Error loading markdown:', error);
        currentMarkdown = defaultMarkdown;
         alert('Error loading saved links. Using default content. See browser console for details.');
    } finally {
        // Lex/group the loaded/default markdown
        const parsedData = lexAndGroupMarkdown(currentMarkdown);
        topLevelTitle = parsedData.title;
        linkGroups = parsedData.groups;

        // Initial render
        renderSidebarTitle();
        renderGroupSelector();
        const initialGroup = groupSelector.value;
         if (initialGroup) {
            renderLinks(initialGroup);
         } else {
             linksDisplay.innerHTML = '<ul><li><em>No content found. Try editing!</em></li></ul>';
         }
    }
}


// --- Event Listeners & Initialization ---
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

    // Basic check if elements exist
    if (!sidebarTitleElement || !groupSelector || !linksDisplay || !editButton || !saveButton || !editModeDiv || !markdownInput || !addTabButton) {
        console.error("One or more essential DOM elements not found!");
        alert("Error initializing sidebar: UI elements missing.");
        return;
    }
     // Check if browser API is available
     if (typeof browser === 'undefined' || !browser.storage || !browser.storage.local || !browser.tabs) {
        console.error('Required browser APIs (storage, tabs) not available. This extension requires Firefox.');
         alert('This extension requires Firefox and necessary permissions (storage, tabs) to function.');
        // Disable controls maybe?
        editButton.disabled = true;
        addTabButton.disabled = true;
        return;
     }


    // Add event listeners
    groupSelector.addEventListener('change', (event) => renderLinks(event.target.value));
    editButton.addEventListener('click', () => toggleEditMode(true));
    saveButton.addEventListener('click', saveMarkdown);
    addTabButton.addEventListener('click', addCurrentTab);

    // Initialize the extension
    loadMarkdown().catch(error => {
        console.error('Error during initialization:', error);
        alert('Error initializing the extension. See browser console for details.');
    });
});

// Add a global error handler for easier debugging
window.addEventListener('error', (event) => {
    console.error('Uncaught error:', event.error);
});
