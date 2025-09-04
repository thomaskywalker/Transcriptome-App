
import * as XLSX from 'xlsx';

export const downloadExcel = (data: any[], filename: string) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Results');
    XLSX.writeFile(wb, `${filename}.xlsx`);
};

export const downloadPlotPng = (svgElement: SVGElement | null, filename:string) => {
    if (!svgElement) return;

    // Clone the SVG element to avoid modifying the original
    const clonedSvgElement = svgElement.cloneNode(true) as SVGElement;
    clonedSvgElement.style.backgroundColor = 'white';

    const svgData = new XMLSerializer().serializeToString(clonedSvgElement);
    const canvas = document.createElement('canvas');
    const svgSize = svgElement.getBoundingClientRect();

    // Increase resolution for better quality PNG
    const scaleFactor = 2;
    canvas.width = svgSize.width * scaleFactor;
    canvas.height = svgSize.height * scaleFactor;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
        // Ensure white background is drawn
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Scale the image as it's drawn
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const link = document.createElement('a');
        link.download = `${filename}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
};