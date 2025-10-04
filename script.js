document.addEventListener('DOMContentLoaded', () => {
    // Main UI Elements
    const imageInput = document.getElementById('image-input');
    const gallery = document.getElementById('gallery');
    const resultsContainer = document.getElementById('results');
    const downloadButton = document.getElementById('download-button');

    // Modal Elements
    const editorModal = document.getElementById('editor-modal');
    const editorCanvas = document.getElementById('editor-canvas');
    const closeButton = document.querySelector('.close-button');
    const saveChangesButton = document.getElementById('save-changes-button');

    let uploadedFiles = [];
    let processedImages = [];
    let currentEditingFile = null;
    let currentEditingIndex = -1;

    class Editor {
        constructor(canvas) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.originalImageData = null;
            this.maskData = null;
            this.activeTool = 'tool-magic-wand';
            this.activeMode = 'mode-add';
            this.brushSize = 10;

            this.toolCanvas = document.createElement('canvas');
            this.toolCtx = this.toolCanvas.getContext('2d');

            this.initEventListeners();
        }

        initEventListeners() {
            document.querySelectorAll('.tool-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    this.activeTool = btn.id;
                });
            });

            document.querySelectorAll('.mode-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    this.activeMode = btn.id;
                });
            });

            document.getElementById('brush-size').addEventListener('input', (e) => {
                this.brushSize = e.target.value;
            });

            let isDrawing = false;
            let lassoPoints = [];

            this.canvas.addEventListener('mousedown', (e) => {
                const rect = this.canvas.getBoundingClientRect();
                const startX = e.clientX - rect.left;
                const startY = e.clientY - rect.top;

                if (this.activeTool === 'tool-brush') {
                    isDrawing = true;
                    this.drawBrush(startX, startY);
                } else if (this.activeTool === 'tool-lasso') {
                    isDrawing = true;
                    lassoPoints = [{ x: startX, y: startY }];
                }
            });

            this.canvas.addEventListener('mousemove', (e) => {
                const rect = this.canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                if (this.activeTool === 'tool-brush' && isDrawing) {
                    this.drawBrush(x, y);
                } else if (this.activeTool === 'tool-lasso' && isDrawing) {
                    lassoPoints.push({ x: x, y: y });
                    this.drawLassoPath(lassoPoints);
                }
            });

            this.canvas.addEventListener('mouseup', () => {
                if (this.activeTool === 'tool-brush' && isDrawing) {
                    isDrawing = false;
                } else if (this.activeTool === 'tool-lasso' && isDrawing) {
                    isDrawing = false;
                    this.applyLassoSelection(lassoPoints);
                }
            });

            this.canvas.addEventListener('click', (e) => {
                const rect = this.canvas.getBoundingClientRect();
                const x = Math.round(e.clientX - rect.left);
                const y = Math.round(e.clientY - rect.top);

                if (this.activeTool === 'tool-eyedropper') {
                    this.pickColor(x, y);
                } else if (this.activeTool === 'tool-magic-wand') {
                    this.floodFill(x, y);
                }
            });
        }

        pickColor(x, y) {
            const pixel = this.ctx.getImageData(x, y, 1, 1).data;
            alert(`Color: rgba(${pixel[0]}, ${pixel[1]}, ${pixel[2]}, ${pixel[3]})`);
        }

        drawBrush(x, y) {
            this.toolCtx.fillStyle = 'white';
            this.toolCtx.beginPath();
            this.toolCtx.arc(x, y, this.brushSize, 0, Math.PI * 2);
            this.toolCtx.fill();
            this.updateMask();
        }

        drawLassoPath(points) {
            this.redrawCanvas();
            this.ctx.strokeStyle = 'blue';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) {
                this.ctx.lineTo(points[i].x, points[i].y);
            }
            this.ctx.stroke();
        }

        applyLassoSelection(points) {
            if (points.length < 3) {
                this.redrawCanvas();
                return;
            }
            this.toolCtx.fillStyle = 'white';
            this.toolCtx.beginPath();
            this.toolCtx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) {
                this.toolCtx.lineTo(points[i].x, points[i].y);
            }
            this.toolCtx.closePath();
            this.toolCtx.fill();
            this.updateMask();
        }

        floodFill(startX, startY) {
            const { width, height, data } = this.originalImageData;
            const startIdx = (startY * width + startX) * 4;
            const startColor = { r: data[startIdx], g: data[startIdx + 1], b: data[startIdx + 2] };
            const tolerance = 20;

            const queue = [[startX, startY]];
            const visited = new Uint8Array(width * height);
            visited[startY * width + startX] = 1;

            const toolImageData = this.toolCtx.createImageData(width, height);
            const toolData = toolImageData.data;

            while (queue.length > 0) {
                const [x, y] = queue.shift();
                const currentIdx = (y * width + x) * 4;

                const r = data[currentIdx];
                const g = data[currentIdx + 1];
                const b = data[currentIdx + 2];
                const distance = Math.sqrt(Math.pow(r - startColor.r, 2) + Math.pow(g - startColor.g, 2) + Math.pow(b - startColor.b, 2));

                if (distance < tolerance) {
                    toolData[currentIdx + 3] = 255;
                    const neighbors = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
                    for (const [nx, ny] of neighbors) {
                        if (nx >= 0 && nx < width && ny >= 0 && ny < height && !visited[ny * width + nx]) {
                            visited[ny * width + nx] = 1;
                            queue.push([nx, ny]);
                        }
                    }
                }
            }
            this.toolCtx.putImageData(toolImageData, 0, 0);
            this.updateMask();
        }

        updateMask() {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = this.canvas.width;
            tempCanvas.height = this.canvas.height;
            const tempCtx = tempCanvas.getContext('2d');

            if (this.maskData) {
                tempCtx.putImageData(this.maskData, 0, 0);
            }

            tempCtx.globalCompositeOperation = this.activeMode === 'mode-add' ? 'source-over' : 'destination-out';
            tempCtx.drawImage(this.toolCanvas, 0, 0);

            this.maskData = tempCtx.getImageData(0, 0, this.canvas.width, this.canvas.height);
            this.toolCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.redrawCanvas();
        }

        setImage(image) {
            this.canvas.width = image.width;
            this.canvas.height = image.height;
            this.toolCanvas.width = image.width;
            this.toolCanvas.height = image.height;
            this.ctx.drawImage(image, 0, 0);
            this.originalImageData = this.ctx.getImageData(0, 0, image.width, image.height);
            this.maskData = this.ctx.createImageData(image.width, image.height);
            this.redrawCanvas();
        }

        getProcessedImage() {
            const finalCanvas = document.createElement('canvas');
            finalCanvas.width = this.canvas.width;
            finalCanvas.height = this.canvas.height;
            const finalCtx = finalCanvas.getContext('2d');
            finalCtx.putImageData(this.originalImageData, 0, 0);
            finalCtx.globalCompositeOperation = 'destination-out';
            finalCtx.putImageData(this.maskData, 0, 0);
            return new Promise(resolve => finalCanvas.toBlob(resolve, 'image/png'));
        }

        redrawCanvas() {
            if (!this.originalImageData) return;
            this.ctx.putImageData(this.originalImageData, 0, 0);
            if (this.maskData) {
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = this.canvas.width;
                tempCanvas.height = this.canvas.height;
                const tempCtx = tempCanvas.getContext('2d');
                tempCtx.putImageData(this.maskData, 0, 0);

                this.ctx.globalAlpha = 0.5;
                this.ctx.fillStyle = 'blue';
                this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
                this.ctx.globalCompositeOperation = 'destination-in';
                this.ctx.drawImage(tempCanvas, 0, 0);
                this.ctx.globalCompositeOperation = 'source-over';
                this.ctx.globalAlpha = 1.0;
            }
        }
    }

    const editor = new Editor(editorCanvas);

    // Modal Handling
    closeButton.onclick = () => editorModal.style.display = 'none';
    window.onclick = (event) => {
        if (event.target == editorModal) {
            editorModal.style.display = 'none';
        }
    };

    gallery.addEventListener('click', (event) => {
        if (event.target.tagName === 'IMG') {
            currentEditingIndex = Array.from(gallery.children).indexOf(event.target);
            currentEditingFile = uploadedFiles[currentEditingIndex];
            if (currentEditingFile) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = new Image();
                    img.onload = () => {
                        editor.setImage(img);
                        editorModal.style.display = 'block';
                    };
                    img.src = e.target.result;
                };
                reader.readAsDataURL(currentEditingFile);
            }
        }
    });

    // File Upload Handling
    imageInput.addEventListener('change', (event) => {
        gallery.innerHTML = '';
        resultsContainer.innerHTML = '';
        downloadButton.style.display = 'none';
        uploadedFiles = [];
        processedImages = [];

        const files = event.target.files;
        for (const file of files) {
            if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
                uploadedFiles.push(file);
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = document.createElement('img');
                    img.src = e.target.result;
                    gallery.appendChild(img);
                };
                reader.readAsDataURL(file);
            }
        }
    });

    // Save and Download Logic
    saveChangesButton.addEventListener('click', async () => {
        const blob = await editor.getProcessedImage();
        const url = URL.createObjectURL(blob);

        const newResult = { name: currentEditingFile.name.replace(/\.[^/.]+$/, ".png"), url: url, blob: blob };

        const existingResultIndex = processedImages.findIndex(p => p.originalIndex === currentEditingIndex);
        if (existingResultIndex > -1) {
            processedImages[existingResultIndex] = { ...newResult, originalIndex: currentEditingIndex };
        } else {
            processedImages.push({ ...newResult, originalIndex: currentEditingIndex });
        }

        resultsContainer.innerHTML = '';
        processedImages.sort((a,b) => a.originalIndex - b.originalIndex).forEach(p => {
            const img = document.createElement('img');
            img.src = p.url;
            resultsContainer.appendChild(img);
        });

        if (processedImages.length > 0) {
            downloadButton.style.display = 'block';
        }

        editorModal.style.display = 'none';
    });

    downloadButton.addEventListener('click', () => {
        const zip = new JSZip();
        for (const image of processedImages) {
            zip.file(image.name, image.blob);
        }

        zip.generateAsync({ type: 'blob' }).then((content) => {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            link.download = 'processed_images.zip';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    });
});