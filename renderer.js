let selectedFiles = [];
let outputPath = "";

window.addEventListener("DOMContentLoaded", async () => {
  const dropArea = document.getElementById("drop-area");
  const fileInput = document.getElementById("file-input");
  const fileList = document.getElementById("file-list");
  const outputPathInput = document.getElementById("output-path");

  // Set default output path
  outputPath = window.electronAPI.getDefaultDocumentsPath();
  outputPathInput.value = outputPath;

  // Browse output folder
  document
    .getElementById("choose-output")
    .addEventListener("click", async () => {
      const chosen = await window.electronAPI.selectOutputFolder();
      if (chosen) {
        outputPath = chosen;
        outputPathInput.value = chosen;
      }
    });

  // Click to select files
  dropArea.addEventListener("click", () => fileInput.click());

  // Drag & drop
  dropArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropArea.style.borderColor = "green";
  });

  dropArea.addEventListener("dragleave", () => {
    dropArea.style.borderColor = "#aaa";
  });

  dropArea.addEventListener("drop", (e) => {
    e.preventDefault();
    dropArea.style.borderColor = "#aaa";
    handleFiles(e.dataTransfer.files);
  });

  fileInput.addEventListener("change", () => {
    handleFiles(fileInput.files);
    fileInput.value = ""; // allow re-selection of same files
  });

  function handleFiles(fileListObj) {
    for (const file of fileListObj) {
      if (
        !selectedFiles.includes(file.path) &&
        (file.name.endsWith(".xml") || file.name.endsWith(".musicxml"))
      ) {
        selectedFiles.push(file.path);
      }
    }
    updateFileList();
  }

  function updateFileList() {
    fileList.innerHTML = "";
    selectedFiles.forEach((filePath, index) => {
      const box = document.createElement("div");
      box.className = "file-box";

      const nameSpan = document.createElement("span");
      nameSpan.className = "file-name";
      nameSpan.textContent = filePath;

      const removeBtn = document.createElement("button");
      removeBtn.className = "remove-btn";
      removeBtn.textContent = "×";
      removeBtn.addEventListener("click", () => {
        selectedFiles.splice(index, 1);
        updateFileList();
      });

      box.appendChild(nameSpan);
      box.appendChild(removeBtn);
      fileList.appendChild(box);
    });
  }

  // Fix button
  document.getElementById("process-btn").addEventListener("click", async () => {
    if (selectedFiles.length === 0) {
      alert("No files selected.");
      return;
    }
    if (!outputPath) {
      alert("No output folder selected.");
      return;
    }
    await window.electronAPI.processFiles(selectedFiles, outputPath);
    alert("All files processed and saved.");
  });

  //Options

  // Accordion toggle
  const optionsHeader = document.getElementById("options-header");
  const optionsBody = document.getElementById("options-body");

  optionsHeader.addEventListener("click", () => {
    const isOpen = optionsBody.style.display === "block";
    optionsBody.style.display = isOpen ? "none" : "block";
    optionsHeader.classList.toggle("opened", !isOpen);
  });

  // Select All / Uncheck All behavior
  const selectAllCheckbox = document.getElementById("select-all");
  const optionCheckboxes = document.querySelectorAll(".option-checkbox");

  selectAllCheckbox.addEventListener("change", () => {
    optionCheckboxes.forEach((cb) => {
      cb.checked = selectAllCheckbox.checked;
    });
  });

  optionCheckboxes.forEach((cb) => {
    cb.addEventListener("change", () => {
      const allChecked = Array.from(optionCheckboxes).every((c) => c.checked);
      const noneChecked = Array.from(optionCheckboxes).every((c) => !c.checked);
      selectAllCheckbox.checked = allChecked;
      selectAllCheckbox.indeterminate = !allChecked && !noneChecked;
    });
  });

  // Fix button - collect selected options
  document.getElementById("process-btn").addEventListener("click", async () => {
    if (selectedFiles.length === 0) {
      alert("No files selected.");
      return;
    }
    if (!outputPath) {
      alert("No output folder selected.");
      return;
    }

    // collect selected fix options
    const enabledFixes = Array.from(optionCheckboxes)
      .filter((cb) => cb.checked)
      .map((cb) => cb.value);

    await window.electronAPI.processFiles(
      selectedFiles,
      outputPath,
      enabledFixes
    );

    alert("All files processed and saved.");
  });
});
