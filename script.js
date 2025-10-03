document.addEventListener('DOMContentLoaded', () => {
    const imageInput = document.getElementById('image-input');
    const gallery = document.getElementById('gallery');
    const resultsContainer = document.getElementById('results');
    const processButton = document.getElementById('process-button');
    const downloadButton = document.getElementById('download-button');

    let uploadedFiles = [];

    imageInput.addEventListener('change', (event) => {
        // Clear previous uploads
        gallery.innerHTML = '';
        resultsContainer.innerHTML = '';
        downloadButton.style.display = 'none';
        uploadedFiles = [];

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

    const colorPicker = document.getElementById('color-picker');

    function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    async function removeBackgroundManually(file, targetColor) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);

                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const data = imageData.data;
                    const tolerance = 20; // Adjust tolerance as needed

                    for (let i = 0; i < data.length; i += 4) {
                        const r = data[i];
                        const g = data[i + 1];
                        const b = data[i + 2];

                        const distance = Math.sqrt(
                            Math.pow(r - targetColor.r, 2) +
                            Math.pow(g - targetColor.g, 2) +
                            Math.pow(b - targetColor.b, 2)
                        );

                        if (distance < tolerance) {
                            data[i + 3] = 0; // Set alpha to 0 (transparent)
                        }
                    }
                    ctx.putImageData(imageData, 0, 0);
                    canvas.toBlob(resolve, 'image/png');
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    processButton.addEventListener('click', async () => {
        if (uploadedFiles.length === 0) {
            alert('Please upload some images first.');
            return;
        }

        resultsContainer.innerHTML = '<p>Processing... Please wait.</p>';
        const processedImages = [];
        const targetColor = hexToRgb(colorPicker.value);

        if (!targetColor) {
            alert('Invalid color selected.');
            return;
        }

        for (const file of uploadedFiles) {
            try {
                const resultBlob = await removeBackgroundManually(file, targetColor);
                const resultUrl = URL.createObjectURL(resultBlob);
                processedImages.push({ name: file.name.replace(/\.[^/.]+$/, "") + ".png", url: resultUrl });

                const img = document.createElement('img');
                img.src = resultUrl;
                resultsContainer.appendChild(img);

            } catch (error) {
                console.error('Error processing image:', file.name, error);
                const errorMsg = document.createElement('p');
                errorMsg.textContent = `Failed to process ${file.name}.`;
                resultsContainer.appendChild(errorMsg);
            }
        }

        const processingMessage = resultsContainer.querySelector('p');
        if (processingMessage) resultsContainer.removeChild(processingMessage);

        if (processedImages.length > 0) {
            downloadButton.style.display = 'block';
            downloadButton.dataset.processed = JSON.stringify(processedImages);
        }
    });

    downloadButton.addEventListener('click', async () => {
        const processedImages = JSON.parse(downloadButton.dataset.processed);
        if (!processedImages || processedImages.length === 0) {
            alert('No processed images to download.');
            return;
        }

        const zip = new JSZip();
        for (const image of processedImages) {
            const response = await fetch(image.url);
            const blob = await response.blob();
            zip.file(image.name, blob);
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