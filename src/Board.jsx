import React, { useRef, useEffect, useState } from "react";
import rough from "roughjs";
import { Square, Pencil, MousePointer2, RotateCcw, ArrowBigRight, Eraser, Type, Download, Save, Info, X, Upload } from "lucide-react";

const roughInstance = rough.default ? rough.default : rough;
const generator = roughInstance.generator();

const isWithinElement = (x, y, element) => {
    if (!element) return false;

    if (element.type === 'rectangle' || element.type === 'arrow' || element.type === 'text') {
        const isXWithin = x >= element.x && x <= element.x + element.width;
        const isYWithin = y >= element.y && y <= element.y + element.height;
        return isXWithin && isYWithin;
    } else if (element.type === 'pencil') {
        return element.points.some(point => {
            const distance = Math.sqrt(Math.pow(point[0] - x, 2) + Math.pow(point[1] - y, 2));
            return distance <= 20;
        });
    }
    return false;
};

const getElementAtPosition = (x, y, elements) => {
    return elements
        .slice()
        .reverse()
        .find(element => isWithinElement(x, y, element));
};

const generateArrow = (x1, y1, x2, y2, color) => {
    const headLength = 20;
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const options = { stroke: color, strokeWidth: 3, roughness: 1.5 };

    const line = generator.line(x1, y1, x2, y2, options);

    const arrowHead1 = generator.line(
        x2,
        y2,
        x2 - headLength * Math.cos(angle - Math.PI / 6),
        y2 - headLength * Math.sin(angle - Math.PI / 6),
        options
    );

    const arrowHead2 = generator.line(
        x2,
        y2,
        x2 - headLength * Math.cos(angle + Math.PI / 6),
        y2 - headLength * Math.sin(angle + Math.PI / 6),
        options
    );

    return [line, arrowHead1, arrowHead2];
};

const Board = () => {
    const [strokeColor, setStrokeColor] = useState('#000000');
    const canvasRef = useRef(null);
    const [textMode, setTextMode] = useState(false);
    const [textContent, setTextContent] = useState('');
    const [textPos, setTextPos] = useState({ x: 0, y: 0 });
    const [textSize, setTextSize] = useState(16);
    const [pencilWidth, setPencilWidth] = useState(2);
    const [cursorVisible, setCursorVisible] = useState(true);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [showShortcutsMenu, setShowShortcutsMenu] = useState(false);
    const [elements, setElements] = useState([]);
    const [isDrawing, setIsDrawing] = useState(false);
    const [tool, setTool] = useState("pencil");
    const [points, setPoints] = useState([]);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });
    const [selectedElement, setSelectedElement] = useState(null);
    const [action, setAction] = useState('none');



    // İmleç yanıp sönmesi
    useEffect(() => {
        if (!textMode) return;
        
        const interval = setInterval(() => {
            setCursorVisible(prev => !prev);
        }, 500);
        
        return () => clearInterval(interval);
    }, [textMode]);

    const undo = () => {
        setElements(prev => {
            if (prev.length === 0) return prev;
            return prev.slice(0, -1);
        });
    };

    const clearCanvas = () => {
        if (window.confirm('Tüm çizimleri silmek istediğinize emin misiniz?')) {
            setElements([]);
        }
    };

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (textMode) {
                event.preventDefault();
                event.stopPropagation();
                
                if (event.key === 'Enter') {
                    finishText();
                } else if (event.key === 'Escape') {
                    cancelText();
                } else if (event.key === 'Backspace') {
                    setTextContent(prev => prev.slice(0, -1));
                } else if (event.key === 'Tab') {
                    event.preventDefault();
                } else if (event.key.length === 1 || 
                          event.key === ' ' || 
                          event.key.includes('Arrow') ||
                          event.key.includes('Digit') ||
                          event.key.includes('Numpad')) {
                    if (event.key === ' ') {
                        setTextContent(prev => prev + ' ');
                    } else if (!event.ctrlKey && !event.metaKey && !event.altKey) {
                        const char = event.key;
                        setTextContent(prev => prev + char);
                    }
                }
                return;
            }

            if (event.ctrlKey || event.metaKey) {
                switch (event.key.toLowerCase()) {
                    case 'z':
                        event.preventDefault();
                        undo();
                        break;
                    case 's':
                        event.preventDefault();
                        setShowExportMenu(true);
                        break;
                }
            } else {
                switch (event.key.toLowerCase()) {
                    case 'v':
                        setTool("selection");
                        break;
                    case 'p':
                        setTool("pencil");
                        break;
                    case 'e':
                        setTool("eraser");
                        break;
                    case 'a':
                        setTool("arrow");
                        break;
                    case 'r':
                        setTool("rectangle");
                        break;
                    case 't':
                        setTool("text");
                        break;
                    case 'delete':
                    case 'backspace':
                        if (selectedElement) {
                            deleteSelectedElement();
                        }
                        break;
                    case '?':
                        setShowShortcutsMenu(true);
                        break;
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown, true);
        return () => {
            window.removeEventListener("keydown", handleKeyDown, true);
        };
    }, [elements, textMode, textContent, selectedElement]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const rc = roughInstance.canvas(canvas);

        elements.forEach(element => {
            if (element.type === 'arrow' && Array.isArray(element.roughElement)) {
                element.roughElement.forEach(el => rc.draw(el));
            } else if (element.type === 'text') {
                ctx.font = `${element.fontSize || textSize}px Arial`;
                ctx.fillStyle = element.strokeColor || strokeColor;
                ctx.fillText(element.text, element.x, element.y + (element.fontSize || textSize));
            } else if (element.roughElement) {
                rc.draw(element.roughElement);
            }
        });

        if (textMode) {
            ctx.font = `${textSize}px Arial`;
            ctx.fillStyle = strokeColor;
            ctx.fillText(textContent, textPos.x, textPos.y + textSize);

            if (cursorVisible) {
                const textWidth = ctx.measureText(textContent).width;
                ctx.fillStyle = strokeColor;
                ctx.fillRect(
                    textPos.x + textWidth, 
                    textPos.y, 
                    2, 
                    textSize
                );
            }

            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 2]);
            const textWidth = ctx.measureText(textContent).width;
            ctx.strokeRect(
                textPos.x - 2,
                textPos.y - 2,
                textWidth + 4,
                textSize + 4
            );
            ctx.setLineDash([]);
        }
    }, [elements, textMode, textContent, textSize, strokeColor, cursorVisible]);

    const finishText = () => {
        if (!textContent.trim()) {a
            cancelText();
            return;
        }

        const newElement = {
            type: "text",
            x: textPos.x,
            y: textPos.y,
            text: textContent,
            fontSize: textSize,
            strokeColor: strokeColor,
            width: textContent.length * (textSize * 0.6),
            height: textSize
        };

        setElements(prev => [...prev, newElement]);
        cancelText();
    };

    const cancelText = () => {
        setTextMode(false);
        setTextContent('');
        setCursorVisible(true);
    };

    const deleteSelectedElement = () => {
        if (selectedElement) {
            setElements(prev => prev.filter(el => el !== selectedElement));
            setSelectedElement(null);
        }
    };



    const exportAsPNG = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const link = document.createElement('a');
        link.download = `drawit-${new Date().getTime()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        setShowExportMenu(false);
    };

    const exportAsJPEG = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const link = document.createElement('a');
        link.download = `drawit-${new Date().getTime()}.jpg`;
        
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        tempCtx.fillStyle = '#ffffff';
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        tempCtx.drawImage(canvas, 0, 0);
        
        link.href = tempCanvas.toDataURL('image/jpeg', 0.9);
        link.click();
        setShowExportMenu(false);
    };

    const saveProject = () => {
        const data = {
            elements: elements,
            settings: {
                strokeColor,
                textSize
            },
            version: '1.0',
            timestamp: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
        const link = document.createElement('a');
        link.download = `drawit-project-${new Date().getTime()}.drawit`;
        link.href = URL.createObjectURL(blob);
        link.click();
        setShowExportMenu(false);
    };

    const loadProject = (event) => {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                setElements(data.elements || []);
                setStrokeColor(data.settings?.strokeColor || '#000000');
                setTextSize(data.settings?.textSize || 16);
            } catch (error) {
                console.error('Proje yüklenirken hata:', error);
            }
        };
        reader.readAsText(file);
    };

    const startDrawing = ({ nativeEvent }) => {
        const { offsetX, offsetY } = nativeEvent;
        
        if (textMode) {
            finishText();
            return;
        }

        setStartPos({ x: offsetX, y: offsetY });

        if (tool === 'selection') {
            const element = getElementAtPosition(offsetX, offsetY, elements);
            if (element) {
                setSelectedElement(element);
                setAction('moving');
                return;
            }
        }

        if (tool === 'eraser') {
            setAction('erasing');
            return;
        }

        if (tool === 'text') {
            setTextMode(true);
            setTextPos({ x: offsetX, y: offsetY });
            setTextContent('');
            setCursorVisible(true);
            return;
        }

        setIsDrawing(true);
        setAction('drawing');

        if (tool === "pencil") {
            setPoints([[offsetX, offsetY]]);
        }
    };

    const draw = ({ nativeEvent }) => {
        if (textMode) return;

        const { offsetX, offsetY } = nativeEvent;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const rc = roughInstance.canvas(canvas);

        if (action === 'moving' && selectedElement) {
            const deltaX = offsetX - startPos.x;
            const deltaY = offsetY - startPos.y;

            setElements(prevElements => {
                const elementsCopy = [...prevElements];
                const index = elementsCopy.findIndex(el => el === selectedElement);
                if (index === -1) return prevElements;
                const el = elementsCopy[index];
                
                const currentColor = el.strokeColor || strokeColor;

                if (el.type === 'rectangle') {
                    const newX = el.x + deltaX;
                    const newY = el.y + deltaY;
                    const roughElement = generator.rectangle(newX, newY, el.width, el.height, { stroke: currentColor, strokeWidth: 3 });
                    elementsCopy[index] = { ...el, x: newX, y: newY, roughElement };
                } else if (el.type === 'arrow') {
                    const newX1 = el.x1 + deltaX;
                    const newY1 = el.y1 + deltaY;
                    const newX2 = el.x2 + deltaX;
                    const newY2 = el.y2 + deltaY;
                    const roughArr = generateArrow(newX1, newY1, newX2, newY2, currentColor);
                    const minX = Math.min(newX1, newX2);
                    const minY = Math.min(newY1, newY2);
                    const width = Math.abs(newX2 - newX1);
                    const height = Math.abs(newY2 - newY1);
                    elementsCopy[index] = {
                        ...el, x1: newX1, y1: newY1, x2: newX2, y2: newY2, x: minX, y: minY, width, height, roughElement: roughArr
                    };
                } else if (el.type === 'pencil') {
                    const newX = el.x + deltaX;
                    const newY = el.y + deltaY;
                    const movedPoints = el.points.map(p => [p[0] + deltaX, p[1] + deltaY]);
                    const roughElement = generator.linearPath(movedPoints, { 
                        stroke: currentColor, 
                        strokeWidth: el.pencilWidth || 2, 
                        roughness: 0.5 
                    });
                    elementsCopy[index] = { ...el, x: newX, y: newY, points: movedPoints, roughElement };
                } else if (el.type === 'text') {
                    elementsCopy[index] = { 
                        ...el, 
                        x: el.x + deltaX, 
                        y: el.y + deltaY 
                    };
                }
                return elementsCopy;
            });

            setStartPos({ x: offsetX, y: offsetY });
            return;
        }

        if (action === 'erasing') {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            elements.forEach(element => {
                if (element.type === 'arrow' && Array.isArray(element.roughElement)) {
                    element.roughElement.forEach(el => rc.draw(el));
                } else if (element.type === 'text') {
                    ctx.font = `${element.fontSize || textSize}px Arial`;
                    ctx.fillStyle = element.strokeColor || strokeColor;
                    ctx.fillText(element.text, element.x, element.y + (element.fontSize || textSize));
                } else if (element.roughElement) {
                    rc.draw(element.roughElement);
                }
            });

            const elementToErase = getElementAtPosition(offsetX, offsetY, elements);
            if (elementToErase) {
                setElements(prev => prev.filter(el => el !== elementToErase));
            }

            ctx.beginPath();
            ctx.arc(offsetX, offsetY, 15, 0, 2 * Math.PI);
            ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 2;
            ctx.fill();
            ctx.stroke();
            return;
        }

        if (action !== 'drawing') return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        elements.forEach(element => {
            if (element.type === 'arrow' && Array.isArray(element.roughElement)) {
                element.roughElement.forEach(el => rc.draw(el));
            } else if (element.type === 'text') {
                ctx.font = `${element.fontSize || textSize}px Arial`;
                ctx.fillStyle = element.strokeColor || strokeColor;
                ctx.fillText(element.text, element.x, element.y + (element.fontSize || textSize));
            } else if (element.roughElement) {
                rc.draw(element.roughElement);
            }
        });

        if (tool === "rectangle") {
            const minX = Math.min(startPos.x, offsetX);
            const minY = Math.min(startPos.y, offsetY);
            const width = Math.abs(startPos.x - offsetX);
            const height = Math.abs(startPos.y - offsetY);
            const roughElement = generator.rectangle(minX, minY, width, height, { stroke: strokeColor, strokeWidth: 3 });
            rc.draw(roughElement);
        } else if (tool === "pencil") {
            const newPoints = [...points, [offsetX, offsetY]];
            setPoints(newPoints);
            const roughElement = generator.linearPath(newPoints, { 
                stroke: strokeColor, 
                strokeWidth: pencilWidth, 
                roughness: 0.5 
            });
            rc.draw(roughElement);
        } else if (tool === "arrow") {
            const x1 = startPos.x;
            const y1 = startPos.y;
            const x2 = offsetX;
            const y2 = offsetY;
            const roughArr = generateArrow(x1, y1, x2, y2, strokeColor);
            roughArr.forEach(el => rc.draw(el));
        }
    };

    const stopDrawing = ({ nativeEvent }) => {
        if (textMode) return;

        if (action === 'moving') {
            setSelectedElement(null);
            setAction('none');
            return;
        }

        if (action === 'erasing') {
            setIsDrawing(false);
            setAction('none');
            return;
        }

        if (action !== 'drawing') return;

        const { offsetX, offsetY } = nativeEvent;

        let newElement = null;

        if (tool === "rectangle") {
            const minX = Math.min(startPos.x, offsetX);
            const minY = Math.min(startPos.y, offsetY);
            const width = Math.abs(startPos.x - offsetX);
            const height = Math.abs(startPos.y - offsetY);

            if (width > 5 && height > 5) {
                const roughElement = generator.rectangle(minX, minY, width, height, { stroke: strokeColor, strokeWidth: 3 });
                newElement = { type: "rectangle", x: minX, y: minY, width, height, roughElement, strokeColor };
            }
        } else if (tool === "pencil") {
            if (points.length > 1) {
                const roughElement = generator.linearPath(points, { 
                    stroke: strokeColor, 
                    strokeWidth: pencilWidth, 
                    roughness: 0.5 
                });
                const minX = Math.min(...points.map(p => p[0]));
                const minY = Math.min(...points.map(p => p[1]));
                const maxX = Math.max(...points.map(p => p[0]));
                const maxY = Math.max(...points.map(p => p[1]));
                const width = maxX - minX;
                const height = maxY - minY;
                newElement = { 
                    type: "pencil", 
                    x: minX, 
                    y: minY, 
                    width, 
                    height, 
                    points: points, 
                    roughElement, 
                    strokeColor,
                    pencilWidth 
                };
            }
            setPoints([]);
        } else if (tool === "arrow") {
            const x1 = startPos.x;
            const y1 = startPos.y;
            const x2 = offsetX;
            const y2 = offsetY;

            if (Math.abs(x2 - x1) > 10 || Math.abs(y2 - y1) > 10) {
                const roughArr = generateArrow(x1, y1, x2, y2, strokeColor);
                const minX = Math.min(x1, x2);
                const minY = Math.min(y1, y2);
                const width = Math.abs(x2 - x1);
                const height = Math.abs(y2 - y1);
                newElement = {
                    type: "arrow",
                    x: minX,
                    y: minY,
                    width,
                    height,
                    x1,
                    y1,
                    x2,
                    y2,
                    roughElement: roughArr,
                    strokeColor
                };
            }
        }

        if (newElement) {
            setElements(prev => [...prev, newElement]);
        }

        setIsDrawing(false);
        setAction('none');
    };

    const shortcuts = [
        { key: 'V', desc: 'Seçim aracı' },
        { key: 'P', desc: 'Kalem' },
        { key: 'E', desc: 'Silgi' },
        { key: 'A', desc: 'Ok aracı' },
        { key: 'R', desc: 'Dikdörtgen' },
        { key: 'T', desc: 'Metin' },
        { key: 'Delete', desc: 'Seçili elementi sil' },
        { key: 'Ctrl + Z', desc: 'Geri al' },
        { key: 'Ctrl + S', desc: 'Dışa aktar menüsü' },
        { key: '?', desc: 'Kısayolları göster' },
    ];

    return (
        <div
            className="h-screen w-screen overflow-hidden bg-white relative"
            style={{
                backgroundImage: 'radial-gradient(#ccc 1px, transparent 1px)',
                backgroundSize: '20px 20px'
            }}
        >
            {elements.length === 0 && (
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none select-none">
                    <h1 className="text-4xl font-serif font-extrabold text-cyan-400 mb-4">DrawIt</h1>
                    <div className="text-gray-400 text-lg space-y-2">
                        <p>🎨 Çizmeye başla!</p>
                        <p className="text-sm">Kısayollar için ? tuşuna bas</p>
                        <p className="text-xs bg-gray-100 inline-block px-2 py-1 rounded mt-2">DrawIt by EnesErbap</p>
                    </div>
                </div>
            )}

            {textMode && (
                <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-black text-white px-4 py-2 rounded-lg text-sm">
                    Yazı Modu: Yazmaya başla (Enter: Kaydet, Esc: İptal, Backspace: Sil)
                </div>
            )}

            {showExportMenu && (
                <div className="fixed top-16 left-1/2 transform -translate-x-1/2 bg-white rounded-lg shadow-xl border border-gray-300 z-30 p-4 min-w-[200px]">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="font-semibold text-gray-700">Dışa Aktar</h3>
                        <button onClick={() => setShowExportMenu(false)} className="text-gray-500 hover:text-gray-700">
                            <X size={20} />
                        </button>
                    </div>
                    <div className="space-y-2">
                        <button
                            onClick={exportAsPNG}
                            className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded flex items-center gap-2"
                        >
                            <Download size={16} />
                            PNG olarak kaydet
                        </button>
                        <button
                            onClick={exportAsJPEG}
                            className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded flex items-center gap-2"
                        >
                            <Download size={16} />
                            JPEG olarak kaydet
                        </button>
                        <button
                            onClick={saveProject}
                            className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded flex items-center gap-2"
                        >
                            <Save size={16} />
                            Projeyi kaydet (.drawit)
                        </button>
                        <div className="relative">
                            <input
                                type="file"
                                id="project-upload"
                                accept=".drawit"
                                onChange={loadProject}
                                className="hidden"
                            />
                            <label
                                htmlFor="project-upload"
                                className="w-full block text-left px-3 py-2 hover:bg-gray-100 rounded flex items-center gap-2 cursor-pointer"
                            >
                                <Upload size={16} />
                                Proje yükle
                            </label>
                        </div>
                    </div>
                </div>
            )}

            {showShortcutsMenu && (
                <div className="fixed top-16 left-1/2 transform -translate-x-1/2 bg-white rounded-lg shadow-xl border border-gray-300 z-30 p-4 min-w-[300px]">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="font-semibold text-gray-700">Kısayol Tuşları</h3>
                        <button onClick={() => setShowShortcutsMenu(false)} className="text-gray-500 hover:text-gray-700">
                            <X size={20} />
                        </button>
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                        {shortcuts.map((shortcut, index) => (
                            <div key={index} className="flex justify-between items-center py-1 border-b border-gray-100 last:border-b-0">
                                <span className="font-medium text-gray-800">{shortcut.desc}</span>
                                <span className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">{shortcut.key}</span>
                            </div>
                        ))}
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-500">
                        Not: ? tuşuna basarak bu menüyü açabilirsin
                    </div>
                </div>
            )}

            <div className="fixed top-4 left-1/2 transform -translate-x-1/2 flex flex-wrap gap-2 p-3 bg-white/95 backdrop-blur-sm rounded-xl shadow-2xl z-10 border-2 border-gray-200 items-center max-w-4xl">
                <div className="flex gap-1 p-1 bg-gray-50 rounded-lg">
                    <button
                        className={`p-2.5 rounded-lg transition-all ${tool === "selection" ? "bg-cyan-500 text-white shadow-md scale-105" : "hover:bg-gray-200 text-gray-700"}`}
                        onClick={() => setTool("selection")}
                        title="Seçim (V)"
                    >
                        <MousePointer2 size={20} />
                    </button>
                    <button
                        className={`p-2.5 rounded-lg transition-all ${tool === "pencil" ? "bg-cyan-500 text-white shadow-md scale-105" : "hover:bg-gray-200 text-gray-700"}`}
                        onClick={() => setTool("pencil")}
                        title="Kalem (P)"
                    >
                        <Pencil size={20} />
                    </button>
                    <button
                        className={`p-2.5 rounded-lg transition-all ${tool === "eraser" ? "bg-cyan-500 text-white shadow-md scale-105" : "hover:bg-gray-200 text-gray-700"}`}
                        onClick={() => setTool("eraser")}
                        title="Silgi (E)"
                    >
                        <Eraser size={20} />
                    </button>
                </div>

                <div className="flex gap-1 p-1 bg-gray-50 rounded-lg">
                    <button
                        className={`p-2.5 rounded-lg transition-all ${tool === "rectangle" ? "bg-cyan-500 text-white shadow-md scale-105" : "hover:bg-gray-200 text-gray-700"}`}
                        onClick={() => setTool("rectangle")}
                        title="Dikdörtgen (R)"
                    >
                        <Square size={20} />
                    </button>
                    <button
                        className={`p-2.5 rounded-lg transition-all ${tool === "arrow" ? "bg-cyan-500 text-white shadow-md scale-105" : "hover:bg-gray-200 text-gray-700"}`}
                        onClick={() => setTool("arrow")}
                        title="Ok (A)"
                    >
                        <ArrowBigRight size={20} />
                    </button>
                    <button
                        className={`p-2.5 rounded-lg transition-all ${tool === "text" ? "bg-cyan-500 text-white shadow-md scale-105" : "hover:bg-gray-200 text-gray-700"}`}
                        onClick={() => setTool("text")}
                        title="Metin (T)"
                    >
                        <Type size={20} />
                    </button>
                </div>
                
                <div className="w-px h-8 bg-gray-300"></div>
                
                <div className="flex gap-2 items-center p-1 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-1.5">
                        <label className="text-xs font-medium text-gray-600">Renk:</label>
                        <input
                            type="color"
                            value={strokeColor}
                            onChange={(e) => setStrokeColor(e.target.value)}
                            className="w-10 h-10 rounded-lg border-2 border-gray-300 cursor-pointer hover:border-cyan-400 transition-colors"
                            title="Renk Seç"
                        />
                    </div>
                    
                    <div className="flex items-center gap-1.5">
                        <label className="text-xs font-medium text-gray-600">Metin:</label>
                        <select
                            value={textSize}
                            onChange={(e) => setTextSize(Number(e.target.value))}
                            className="text-sm border-2 border-gray-300 rounded-lg px-2 py-1.5 cursor-pointer hover:border-cyan-400 transition-colors bg-white"
                            title="Metin boyutu"
                        >
                            <option value={12}>12px</option>
                            <option value={16}>16px</option>
                            <option value={20}>20px</option>
                            <option value={24}>24px</option>
                            <option value={32}>32px</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <label className="text-xs font-medium text-gray-600">Kalem:</label>
                        <select
                            value={pencilWidth}
                            onChange={(e) => setPencilWidth(Number(e.target.value))}
                            className="text-sm border-2 border-gray-300 rounded-lg px-2 py-1.5 cursor-pointer hover:border-cyan-400 transition-colors bg-white"
                            title="Kalem kalınlığı"
                        >
                            <option value={1}>İnce</option>
                            <option value={2}>Normal</option>
                            <option value={4}>Kalın</option>
                            <option value={6}>Çok Kalın</option>
                        </select>
                    </div>
                </div>
                
                <div className="w-px h-8 bg-gray-300"></div>
                
                <div className="flex gap-1 p-1 bg-gray-50 rounded-lg">
                    <button
                        className="p-2.5 rounded-lg hover:bg-blue-100 text-blue-600 transition-all hover:scale-105"
                        onClick={undo}
                        title="Geri Al (Ctrl+Z)"
                    >
                        <RotateCcw size={20} />
                    </button>
                    
                    <button
                        className="p-2.5 rounded-lg hover:bg-red-100 text-red-600 transition-all hover:scale-105"
                        onClick={clearCanvas}
                        title="Tümünü Temizle"
                    >
                        <X size={20} />
                    </button>
                </div>
                
                <div className="w-px h-8 bg-gray-300"></div>
                
                <div className="flex gap-1 p-1 bg-gray-50 rounded-lg">
                    <button
                        className="p-2.5 rounded-lg hover:bg-green-100 text-green-600 transition-all hover:scale-105"
                        onClick={() => setShowExportMenu(!showExportMenu)}
                        title="Kaydet (Ctrl+S)"
                    >
                        <Download size={20} />
                    </button>
                    
                    <button
                        className="p-2.5 rounded-lg hover:bg-purple-100 text-purple-600 transition-all hover:scale-105"
                        onClick={() => setShowShortcutsMenu(!showShortcutsMenu)}
                        title="Kısayollar (?)"
                    >
                        <Info size={20} />
                    </button>
                </div>
            </div>
            
            <canvas
                ref={canvasRef}
                width={window.innerWidth}
                height={window.innerHeight}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
            />
        </div>
    );
};

export default Board;