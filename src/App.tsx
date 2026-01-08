import React, { useState, useEffect, useRef, Component } from 'react';
import { ShoppingBag, Clock, CheckCircle, AlertCircle, Package, Truck, Play, RotateCcw, Settings, Plus, Trash2, ArrowLeft, Image as ImageIcon, Upload, LogOut, Filter, X, RefreshCw, Pencil, Save, XCircle, GripVertical, CheckSquare } from 'lucide-react';

// --- 1. 錯誤捕捉邊界 (Error Boundary) ---
class ErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean }> {
    constructor(props: any) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: any) {
        return { hasError: true };
    }

    componentDidCatch(error: any, errorInfo: any) {
        console.error("系統發生錯誤:", error, errorInfo);
    }

    handleReset = () => {
        localStorage.removeItem('cvs_sim_inventory');
        localStorage.removeItem('cvs_sim_categories');
        localStorage.removeItem('cvs_sim_settings');
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="fixed inset-0 bg-gray-100 flex flex-col items-center justify-center p-4 text-center z-50">
                    <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full">
                        <div className="text-red-500 mb-4 flex justify-center"><AlertCircle size={80} /></div>
                        <h2 className="text-3xl font-bold text-gray-800 mb-4">系統發生了一點小問題</h2>
                        <p className="text-xl text-gray-600 mb-8">
                            可能是因為舊的設定資料與新版本不相容。<br />請點擊下方按鈕來重置系統。
                        </p>
                        <button onClick={this.handleReset} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-xl flex items-center justify-center gap-3 transition-colors text-xl">
                            <RefreshCw size={24} /> 重置並修復
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

// --- 2. 輔助函式：圖片壓縮 ---
const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const MAX_WIDTH = 500;
                const MAX_HEIGHT = 500;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.8));
                } else {
                    reject(new Error("Canvas context error"));
                }
            };
            img.onerror = (e) => reject(e);
        };
        reader.onerror = (e) => reject(e);
    });
};

// --- 3. 預設資料 ---
const DEFAULT_ITEMS = [
    { id: 'p1', name: '茶葉蛋', icon: '🥚', image: null, category: '熱食' },
    { id: 'p2', name: '美式咖啡', icon: '☕', image: null, category: '咖啡' },
    { id: 'p3', name: '拿鐵', icon: '🥛', image: null, category: '咖啡' },
    { id: 'p4', name: '國民便當', icon: '🍱', image: null, category: '鮮食' },
    { id: 'p5', name: '鮪魚飯糰', icon: '🍙', image: null, category: '鮮食' },
    { id: 'p6', name: '肉鬆麵包', icon: '🍞', image: null, category: '麵包' },
    { id: 'p7', name: '綠茶', icon: '🍵', image: null, category: '飲料' },
    { id: 'p8', name: '礦泉水', icon: '💧', image: null, category: '飲料' },
];

const DEFAULT_CATEGORIES = ['熱食', '咖啡', '鮮食', '麵包', '飲料', '零食', '用品', '其他'];

const GAME_STATE = {
    IDLE: 'IDLE',
    PLAYING: 'PLAYING',
    GAME_OVER: 'GAME_OVER',
    ADMIN: 'ADMIN'
};

const STORAGE_KEYS = {
    INVENTORY: 'cvs_sim_inventory',
    CATEGORIES: 'cvs_sim_categories',
    SETTINGS: 'cvs_sim_settings'
};

const safeParse = (key: string, fallback: any) => {
    try {
        const saved = localStorage.getItem(key);
        if (!saved || saved === "undefined" || saved === "null") return fallback;
        return JSON.parse(saved);
    } catch (e) {
        return fallback;
    }
};

// --- 4. 遊戲主邏輯 ---
function GameApp() {
    const [gameState, setGameState] = useState(GAME_STATE.IDLE);

    const [settings, setSettings] = useState(() => safeParse(STORAGE_KEYS.SETTINGS, {
        orderTimeout: 60,
        gameDuration: 180,
        spawnRate: 15000,
        minItemsPerOrder: 1,
        maxItemsPerOrder: 3,
        deliveryPlatform: 'all',
    }));

    const [inventory, setInventory] = useState(() => safeParse(STORAGE_KEYS.INVENTORY, DEFAULT_ITEMS));
    const [categories, setCategories] = useState(() => safeParse(STORAGE_KEYS.CATEGORIES, DEFAULT_CATEGORIES));

    const [orders, setOrders] = useState<any[]>([]);
    const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
    const [pickedItems, setPickedItems] = useState<any[]>([]);
    const [score, setScore] = useState(0);
    const [mistakes, setMistakes] = useState(0);
    const [timeLeft, setTimeLeft] = useState(120);
    const [feedback, setFeedback] = useState<{ msg: string, type: string } | null>(null);
    const [showExitConfirm, setShowExitConfirm] = useState(false);
    const [showPackConfirm, setShowPackConfirm] = useState(false);

    const filterTabs = Array.from(new Set([...(inventory || []).map((i: any) => i.category || '其他')]));
    const [currentCategory, setCurrentCategory] = useState(filterTabs.length > 0 ? filterTabs[0] : '');

    const activeOrder = orders.find(o => o.id === activeOrderId);

    // 後台狀態
    const [newItem, setNewItem] = useState({ name: '', icon: '', image: null as string | null, category: '加工食品類' });
    const [newCategoryName, setNewCategoryName] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const bulkFileInputRef = useRef<HTMLInputElement>(null);
    const [bulkImportItems, setBulkImportItems] = useState<any[]>([]);
    const [showBulkImport, setShowBulkImport] = useState(false);

    useEffect(() => {
        if (filterTabs.length > 0 && !filterTabs.includes(currentCategory)) {
            setCurrentCategory(filterTabs[0]);
        } else if (filterTabs.length === 0) {
            setCurrentCategory('');
        }
    }, [inventory, filterTabs, currentCategory]);

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(inventory));
        } catch (e) {
            alert("儲存空間已滿！請刪除一些商品或不要上傳太多大圖片。");
        }
    }, [inventory]);

    useEffect(() => { localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories)); }, [categories]);
    useEffect(() => { localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings)); }, [settings]);

    useEffect(() => {
        let interval: any;
        if (gameState === GAME_STATE.PLAYING) {
            const rate = Math.max(10000, settings.spawnRate || 10000);
            interval = setInterval(() => { generateOrder(); }, rate);
        }
        return () => clearInterval(interval);
    }, [gameState, settings]);

    useEffect(() => {
        let timer: any;
        if (gameState === GAME_STATE.PLAYING && timeLeft > 0) {
            timer = setInterval(() => { setTimeLeft((prev) => prev - 1); }, 1000);
        } else if (timeLeft <= 0 && gameState === GAME_STATE.PLAYING) {
            setGameState(GAME_STATE.GAME_OVER);
        }
        return () => clearInterval(timer);
    }, [gameState, timeLeft]);

    useEffect(() => {
        if (gameState !== GAME_STATE.PLAYING) return;
        const timer = setInterval(() => {
            setOrders(currentOrders => {
                const now = Date.now();
                const timeout = settings.orderTimeout || 45;
                const expiredOrders = currentOrders.filter(o => (now - o.createdAt) / 1000 > timeout && o.status !== 'ready');
                if (expiredOrders.length > 0) {
                    setMistakes(m => m + expiredOrders.length);
                    showFeedback("訂單超時未處理！扣分！", "error");
                }
                return currentOrders.filter(o => (now - o.createdAt) / 1000 <= timeout || o.status === 'ready');
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [gameState, settings.orderTimeout]);

    useEffect(() => {
        if (activeOrderId && !activeOrder) {
            setActiveOrderId(null);
            setPickedItems([]);
            if (filterTabs.length > 0) setCurrentCategory(filterTabs[0]);
        }
    }, [activeOrderId, activeOrder]);

    // Functions
    const playNotificationSound = () => {
        try {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContext) return;
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(660, ctx.currentTime);
            osc.frequency.setValueAtTime(550, ctx.currentTime + 0.15);
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
            osc.start();
            osc.stop(ctx.currentTime + 0.5);
        } catch (e) { }
    };

    const generateOrder = () => {
        if (!Array.isArray(inventory) || inventory.length === 0) return;

        const minItems = Math.max(1, settings.minItemsPerOrder || 1);
        const maxItems = Math.max(minItems, settings.maxItemsPerOrder || 3);
        const itemCount = Math.floor(Math.random() * (maxItems - minItems + 1)) + minItems;

        const items = [];
        for (let i = 0; i < itemCount; i++) {
            const randomItem = inventory[Math.floor(Math.random() * inventory.length)];
            if (randomItem) items.push(randomItem);
        }
        if (items.length === 0) return;

        let platform = settings.deliveryPlatform;
        if (!platform || platform === 'all') {
            platform = Math.random() > 0.5 ? 'UberEats' : 'FoodPanda';
        }

        const newOrder = {
            id: Math.floor(1000 + Math.random() * 9000).toString(),
            platform: platform,
            items: items,
            status: 'pending',
            createdAt: Date.now(),
            driverArrived: false
        };
        setOrders(prev => {
            if (prev.length < 5) {
                playNotificationSound();
                return [...prev, newOrder];
            }
            return prev;
        });
    };

    const startGame = () => {
        if (!inventory || inventory.length === 0) {
            alert("請先在後台新增至少一樣商品！");
            return;
        }

        setGameState(GAME_STATE.PLAYING);
        setScore(0);
        setMistakes(0);
        setTimeLeft(settings.gameDuration || 120);
        setOrders([]);
        setActiveOrderId(null);
        setPickedItems([]);
        if (filterTabs.length > 0) setCurrentCategory(filterTabs[0]);
        setShowExitConfirm(false);
        generateOrder();
    };

    const handleStartPicking = (orderId: string) => {
        setActiveOrderId(orderId);
        setPickedItems([]);
        if (filterTabs.length > 0) setCurrentCategory(filterTabs[0]);
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'picking' } : o));
    };

    const handlePickItem = (item: any) => {
        if (!activeOrderId || !activeOrder) return;
        const neededItems = activeOrder.items;
        const alreadyPickedCount = pickedItems.filter(i => i.id === item.id).length;
        const neededCount = neededItems.filter(i => i.id === item.id).length;
        if (alreadyPickedCount < neededCount) {
            setPickedItems([...pickedItems, item]);
            if (pickedItems.length + 1 === neededItems.length) showFeedback("撿貨完成！請打包", "success");
        } else {
            setMistakes(prev => prev + 1);
            showFeedback("撿錯了！", "error");
        }
    };

    const handlePackOrder = () => {
        if (!activeOrderId) return;
        setShowPackConfirm(true);
    };

    const confirmPackOrder = () => {
        if (!activeOrderId) return;
        setOrders(prev => prev.map(o => o.id === activeOrderId ? { ...o, status: 'ready', driverArrived: true } : o));
        setActiveOrderId(null);
        setPickedItems([]);
        setScore(prev => prev + 10);
        showFeedback("打包完成，等待司機！", "success");
        setShowPackConfirm(false);
    };

    const handleDriverPickup = (orderId: string) => {
        setOrders(prev => prev.filter(o => o.id !== orderId));
        setScore(prev => prev + 20);
        showFeedback(`訂單 ${orderId.slice(-3)} 完成！`, "success");
    };

    const showFeedback = (msg: string, type: string) => {
        setFeedback({ msg, type });
        setTimeout(() => setFeedback(null), 1500);
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            try {
                setIsUploading(true);
                const compressedBase64 = await compressImage(file);
                setNewItem(prev => ({ ...prev, image: compressedBase64 }));
            } catch (error) {
                alert("圖片處理失敗，請試著換一張圖片。");
                console.error(error);
            } finally {
                setIsUploading(false);
            }
        }
    };

    const handleAddItem = () => {
        if (!newItem.name || (!newItem.icon && !newItem.image)) {
            alert("請輸入商品名稱，並提供 Emoji 圖示或上傳照片");
            return;
        }

        if (editingId) {
            setInventory(inventory.map((item: any) =>
                item.id === editingId ? { ...item, ...newItem } : item
            ));
            setEditingId(null);
        } else {
            const item = { id: 'custom_' + Date.now(), ...newItem, icon: newItem.icon || '📦' };
            setInventory([...inventory, item]);
        }

        setNewItem(prev => ({ name: '', icon: '', image: null, category: prev.category }));
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleEditItem = (item: any) => {
        setNewItem({
            name: item.name,
            icon: item.icon || '',
            image: item.image,
            category: item.category
        });
        setEditingId(item.id);
        document.querySelector('.admin-form')?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleCancelEdit = () => {
        setNewItem({ name: '', icon: '', image: null, category: categories[0] || '其他' });
        setEditingId(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleDeleteItem = (id: string) => {
        if (inventory.length <= 1) { alert("至少保留一項商品"); return; }
        if (window.confirm("確定要刪除這個商品嗎？")) {
            setInventory(inventory.filter((i: any) => i.id !== id));
            if (editingId === id) handleCancelEdit();
        }
    };

    const handleBulkFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        const items: any[] = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.type.startsWith('image/')) {
                try {
                    const compressedBase64 = await compressImage(file);
                    const fileName = file.name.replace(/\.[^/.]+$/, '');
                    items.push({
                        id: `bulk_${Date.now()}_${i}`,
                        name: fileName,
                        image: compressedBase64,
                        category: '加工食品類',
                        icon: ''
                    });
                } catch (error) {
                    console.error('Image compression failed:', error);
                }
            }
        }
        setBulkImportItems(items);
        setShowBulkImport(true);
    };

    const handleBulkItemNameChange = (id: string, newName: string) => {
        setBulkImportItems(bulkImportItems.map(item =>
            item.id === id ? { ...item, name: newName } : item
        ));
    };

    const handleBulkItemCategoryChange = (id: string, newCategory: string) => {
        setBulkImportItems(bulkImportItems.map(item =>
            item.id === id ? { ...item, category: newCategory } : item
        ));
    };

    const handleRemoveBulkItem = (id: string) => {
        setBulkImportItems(bulkImportItems.filter(item => item.id !== id));
    };

    const handleConfirmBulkImport = () => {
        const newItems = bulkImportItems.map(item => ({
            ...item,
            id: `custom_${Date.now()}_${Math.random()}`
        }));
        setInventory([...inventory, ...newItems]);
        setBulkImportItems([]);
        setShowBulkImport(false);
        if (bulkFileInputRef.current) bulkFileInputRef.current.value = '';
    };

    const handleAddCategory = () => {
        if (!newCategoryName.trim()) return;
        if (categories.includes(newCategoryName.trim())) { alert("此類別已存在"); return; }
        setCategories([...categories, newCategoryName.trim()]);
        setNewCategoryName('');
    };

    const handleDeleteCategory = (catToDelete: string) => {
        if (categories.length <= 1) { alert("至少保留一個類別"); return; }
        if (window.confirm(`確定要刪除「${catToDelete}」類別嗎？`)) {
            setCategories(categories.filter((c: any) => c !== catToDelete));
            if (newItem.category === catToDelete) {
                setNewItem(prev => ({ ...prev, category: categories.find((c: any) => c !== catToDelete) || '其他' }));
            }
        }
    };

    const handleDragStart = (index: number) => {
        setDraggedItemIndex(index);
    };

    const handleDragOver = (index: number) => {
        if (draggedItemIndex === null || draggedItemIndex === index) return;

        const newCategories = [...categories];
        const draggedItem = newCategories[draggedItemIndex];
        newCategories.splice(draggedItemIndex, 1);
        newCategories.splice(index, 0, draggedItem);

        setCategories(newCategories);
        setDraggedItemIndex(index);
    };

    const handleDragEnd = () => {
        setDraggedItemIndex(null);
    };

    const getCategoryCount = (categoryName: string) => {
        return inventory.filter((item: any) => item.category === categoryName).length;
    };

    const handleResetData = () => {
        if (window.confirm("確定要重置所有資料嗎？所有的自訂商品和設定都會消失！")) {
            localStorage.removeItem(STORAGE_KEYS.INVENTORY);
            localStorage.removeItem(STORAGE_KEYS.CATEGORIES);
            localStorage.removeItem(STORAGE_KEYS.SETTINGS);
            window.location.reload();
        }
    };

    const ItemDisplay = ({ item, size = "md", className = "" }: any) => {
        if (!item) return <div className={`bg-gray-100 ${className}`}></div>;

        let sizeClass = "";
        if (size === "lg") {
            sizeClass = "w-32 h-32 text-6xl";
        } else if (size === "md") {
            sizeClass = "w-20 h-20 text-4xl";
        } else {
            sizeClass = "w-12 h-12 text-2xl";
        }

        return (
            <div className={`flex items-center justify-center overflow-hidden rounded bg-white shadow-sm border border-slate-200 ${sizeClass} ${className}`}>
                {item.image ? (
                    <img src={item.image} alt={item.name} className="w-full h-full object-contain p-1" />
                ) : (
                    <span className="flex items-center justify-center h-full w-full">{item.icon}</span>
                )}
            </div>
        );
    };

    const filteredInventory = inventory.filter((i: any) => i.category === currentCategory);

    if (gameState === GAME_STATE.ADMIN) {
        return (
            <div className="fixed inset-0 bg-slate-100 p-8 font-sans overflow-auto">
                {showBulkImport && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                            <div className="bg-slate-800 text-white p-6 flex justify-between items-center shrink-0">
                                <h3 className="text-2xl font-bold flex items-center gap-2"><Upload /> 批量匯入商品</h3>
                                <button onClick={() => { setShowBulkImport(false); setBulkImportItems([]); }} className="text-white hover:bg-slate-700 p-2 rounded"><X size={24} /></button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                {bulkImportItems.length === 0 ? (
                                    <div className="text-center py-10 text-slate-400">
                                        <ImageIcon size={48} className="mx-auto mb-4 opacity-30" />
                                        <p>未選擇任何圖片</p>
                                    </div>
                                ) : (
                                    bulkImportItems.map(item => (
                                        <div key={item.id} className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex gap-4 items-start">
                                            <div className="shrink-0">
                                                <img src={item.image} alt={item.name} className="w-24 h-24 object-cover rounded border border-slate-300" />
                                            </div>
                                            <div className="flex-1 space-y-3">
                                                <div>
                                                    <label className="text-xs text-slate-500 block mb-1 font-bold">商品名稱</label>
                                                    <input
                                                        type="text"
                                                        value={item.name}
                                                        onChange={(e) => handleBulkItemNameChange(item.id, e.target.value)}
                                                        className="w-full border border-slate-300 rounded p-2 text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-slate-500 block mb-1 font-bold">分類</label>
                                                    <select
                                                        value={item.category}
                                                        onChange={(e) => handleBulkItemCategoryChange(item.id, e.target.value)}
                                                        className="w-full border border-slate-300 rounded p-2 text-sm bg-white"
                                                    >
                                                        {categories.map((cat: any) => (
                                                            <option key={cat} value={cat}>{cat}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleRemoveBulkItem(item.id)}
                                                className="shrink-0 text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded transition-colors"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                            <div className="bg-slate-100 p-6 flex gap-3 justify-end shrink-0 border-t border-slate-200">
                                <button
                                    onClick={() => { setShowBulkImport(false); setBulkImportItems([]); }}
                                    className="px-6 py-2 bg-slate-300 hover:bg-slate-400 text-slate-800 rounded-lg font-bold transition-colors"
                                >
                                    取消
                                </button>
                                <button
                                    onClick={handleConfirmBulkImport}
                                    disabled={bulkImportItems.length === 0}
                                    className="px-6 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-400 text-white rounded-lg font-bold transition-colors flex items-center gap-2"
                                >
                                    <Plus size={18} /> 匯入 {bulkImportItems.length} 項商品
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="max-w-5xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col h-[85vh]">
                    <div className="bg-slate-800 text-white p-6 flex justify-between items-center shrink-0">
                        <h2 className="text-2xl font-bold flex items-center gap-2"><Settings /> 教師後台管理系統</h2>
                        <div className="flex gap-2">
                            <button onClick={() => bulkFileInputRef.current?.click()} className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded text-sm font-bold flex items-center gap-1"><Upload size={16} /> 批量匯入</button>
                            <input type="file" ref={bulkFileInputRef} multiple accept="image/*" onChange={handleBulkFileSelect} className="hidden" />
                            <button onClick={handleResetData} className="bg-red-600 hover:bg-red-500 px-4 py-2 rounded text-sm font-bold flex items-center gap-1"><Trash2 size={16} /> 重置系統</button>
                            <button onClick={() => setGameState(GAME_STATE.IDLE)} className="bg-slate-600 hover:bg-slate-500 px-4 py-2 rounded flex items-center gap-2"><ArrowLeft size={20} /> 返回首頁</button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-hidden grid md:grid-cols-2 gap-0 divide-x divide-slate-200">
                        <div className="p-8 overflow-y-auto space-y-8">
                            <div>
                                <h3 className="text-xl font-bold text-slate-700 mb-4 border-b pb-2 flex items-center gap-2"><Settings size={20} /> 遊戲參數設定</h3>
                                <div className="space-y-6 pl-2">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-600 mb-2">單筆訂單完成時限 (秒)</label>
                                        <div className="flex items-center gap-4">
                                            <input
                                                type="range" min="10" max="300" step="5"
                                                value={settings.orderTimeout}
                                                onChange={(e) => setSettings({ ...settings, orderTimeout: Number(e.target.value) })}
                                                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                                            />
                                            <span className="text-2xl font-mono font-bold text-blue-600 w-16 text-center">{settings.orderTimeout}s</span>
                                        </div>
                                        <p className="text-xs text-slate-400 mt-1">最高可設定為 300 秒 (5分鐘)。</p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-slate-600 mb-2">遊戲總時間 (秒)</label>
                                        <div className="flex items-center gap-4">
                                            <input type="range" min="30" max="600" step="30" value={settings.gameDuration} onChange={(e) => setSettings({ ...settings, gameDuration: Number(e.target.value) })} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer" />
                                            <span className="text-2xl font-mono font-bold text-blue-600 w-16 text-center">{settings.gameDuration}s</span>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-slate-600 mb-2">每單商品數量 (件)</label>
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-4">
                                                <span className="text-xs text-slate-500 w-8">下限:</span>
                                                <input type="range" min="1" max="8" step="1" value={settings.minItemsPerOrder || 1} onChange={(e) => { const val = Number(e.target.value); setSettings({ ...settings, minItemsPerOrder: val, maxItemsPerOrder: Math.max(val, settings.maxItemsPerOrder || 3) }); }} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer" />
                                                <span className="text-xl font-mono font-bold text-blue-600 w-8 text-center">{settings.minItemsPerOrder || 1}</span>
                                            </div>

                                            <div className="flex items-center gap-4">
                                                <span className="text-xs text-slate-500 w-8">上限:</span>
                                                <input type="range" min="1" max="8" step="1" value={settings.maxItemsPerOrder || 3} onChange={(e) => { const val = Number(e.target.value); setSettings({ ...settings, maxItemsPerOrder: val, minItemsPerOrder: Math.min(val, settings.minItemsPerOrder || 1) }); }} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer" />
                                                <span className="text-xl font-mono font-bold text-blue-600 w-8 text-center">{settings.maxItemsPerOrder || 3}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-slate-600 mb-2">外送平台來源</label>
                                        <select className="w-full border p-2 rounded bg-white text-slate-700" value={settings.deliveryPlatform || 'all'} onChange={(e) => setSettings({ ...settings, deliveryPlatform: e.target.value })}>
                                            <option value="all">混合 (UberEats + FoodPanda)</option>
                                            <option value="UberEats">僅 UberEats</option>
                                            <option value="FoodPanda">僅 FoodPanda</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-slate-600 mb-2">訂單生成時間間隔 (秒)</label>
                                        <div className="flex items-center gap-4">
                                            <input type="range" min="10000" max="40000" step="1000" value={settings.spawnRate || 15000} onChange={(e) => setSettings({ ...settings, spawnRate: Number(e.target.value) })} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer" />
                                            <span className="text-2xl font-mono font-bold text-blue-600 w-16 text-center">{(settings.spawnRate || 15000) / 1000}s</span>
                                        </div>
                                        <p className="text-xs text-slate-400 mt-1">設定每隔幾秒會出現一張新訂單。</p>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-xl font-bold text-slate-700 mb-4 border-b pb-2 flex items-center gap-2"><Filter size={20} /> 類別管理</h3>
                                <div className="pl-2">
                                    <div className="flex gap-2 mb-3">
                                        <input type="text" placeholder="輸入新類別名稱..." className="border p-2 rounded text-sm flex-1" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} />
                                        <button onClick={handleAddCategory} disabled={!newCategoryName.trim()} className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 text-white px-3 rounded">新增</button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {categories.map((cat: any, index: number) => (
                                            <div
                                                key={cat}
                                                draggable
                                                onDragStart={() => handleDragStart(index)}
                                                onDragOver={(e) => { e.preventDefault(); handleDragOver(index); }}
                                                onDragEnd={handleDragEnd}
                                                className={`bg-slate-100 text-slate-700 px-2 py-1 rounded-full text-sm flex items-center gap-1 border border-slate-200 group cursor-move transition-all ${draggedItemIndex === index ? 'opacity-50 scale-105 shadow-md' : ''}`}
                                            >
                                                <GripVertical size={14} className="text-slate-400" />
                                                {cat} ({getCategoryCount(cat)})
                                                <button onClick={() => handleDeleteCategory(cat)} className="text-slate-400 hover:text-red-500 ml-1"><X size={14} /></button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                        </div>

                        <div className="p-8 flex flex-col h-full overflow-hidden">
                            <h3 className="text-xl font-bold text-slate-700 mb-4 border-b pb-2 flex items-center gap-2 shrink-0"><ShoppingBag size={20} /> 商品管理 ({inventory.length})</h3>

                            <div className="admin-form bg-slate-50 p-4 rounded-lg mb-4 space-y-3 border border-slate-200 shrink-0 transition-colors duration-300" style={{ borderColor: editingId ? '#3b82f6' : '#e2e8f0', borderWidth: editingId ? '2px' : '1px' }}>
                                {editingId && <div className="text-blue-600 font-bold text-sm mb-1 flex items-center gap-1"><Pencil size={14} /> 編輯模式</div>}
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="col-span-2">
                                        <label className="text-xs text-slate-500 block mb-1">商品名稱</label>
                                        <input type="text" placeholder="例如: 養樂多" className="w-full border p-2 rounded" value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-500 block mb-1">類別</label>
                                        <select className="w-full border p-2 rounded bg-white text-sm" value={newItem.category} onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}>
                                            {categories.map((cat: any) => (<option key={cat} value={cat}>{cat}</option>))}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-xs text-slate-500 block mb-1">Emoji (選填)</label>
                                        <input type="text" placeholder="🥤" className="w-full border p-2 rounded text-center" value={newItem.icon} onChange={(e) => setNewItem({ ...newItem, icon: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-500 block mb-1">或 上傳照片</label>
                                        <label className={`flex items-center justify-center gap-2 bg-white border border-dashed border-slate-300 rounded p-2 cursor-pointer hover:bg-slate-50 text-slate-600 text-sm h-[42px] ${isUploading ? 'opacity-50 cursor-wait' : ''}`}>
                                            <Upload size={16} />
                                            {isUploading ? "處理中..." : (newItem.image ? "已選圖" : "選擇...")}
                                            <input type="file" accept="image/*" onChange={handleImageUpload} ref={fileInputRef} className="hidden" disabled={isUploading} />
                                        </label>
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    {editingId && (
                                        <button onClick={handleCancelEdit} className="flex-1 bg-gray-400 hover:bg-gray-500 text-white p-2 rounded flex justify-center items-center gap-2 font-bold"><XCircle size={20} /> 取消</button>
                                    )}
                                    <button onClick={handleAddItem} disabled={isUploading} className={`flex-1 text-white p-2 rounded flex justify-center items-center gap-2 font-bold disabled:bg-gray-400 ${editingId ? 'bg-blue-600 hover:bg-blue-500' : 'bg-green-600 hover:bg-green-500'}`}>
                                        {editingId ? <><Save size={20} /> 儲存變更</> : <><Plus size={20} /> 新增商品</>}
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto border rounded-lg bg-white">
                                {inventory.length === 0 ? (
                                    <div className="text-center text-slate-400 py-10">目前沒有商品</div>
                                ) : (
                                    inventory.map((item: any) => (
                                        <div key={item.id} className={`flex justify-between items-center p-3 border-b hover:bg-slate-50 ${editingId === item.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}`}>
                                            <div className="flex items-center gap-3">
                                                <ItemDisplay item={item} size="sm" />
                                                <div>
                                                    <div className="font-medium text-slate-700">{item.name}</div>
                                                    <div className="text-xs text-slate-500 bg-slate-100 inline-block px-1.5 rounded">{item.category}</div>
                                                </div>
                                            </div>
                                            <div className="flex gap-1">
                                                <button onClick={() => handleEditItem(item)} className="text-blue-500 hover:text-blue-700 p-2 rounded hover:bg-blue-100" title="編輯"><Pencil size={18} /></button>
                                                <button onClick={() => handleDeleteItem(item.id)} className="text-red-400 hover:text-red-600 p-2 rounded hover:bg-red-100" title="刪除"><Trash2 size={18} /></button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen w-full bg-gray-100 font-sans text-slate-800 flex flex-col overflow-hidden relative">

            {/* 打包確認視窗 */}
            {showPackConfirm && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full animate-bounce-sm transform transition-all scale-100">
                        <div className="flex flex-col items-center text-center space-y-4">
                            <div className="bg-blue-100 p-4 rounded-full">
                                <CheckSquare className="w-16 h-16 text-blue-600" />
                            </div>
                            <h3 className="text-3xl font-bold text-gray-800">確認打包？</h3>
                            <p className="text-xl text-gray-600 font-medium leading-relaxed">
                                請確認是否已填寫<br />
                                <span className="text-blue-600 font-bold text-2xl">訂單編號</span>？
                            </p>

                            <div className="flex gap-4 w-full mt-6">
                                <button
                                    onClick={() => setShowPackConfirm(false)}
                                    className="flex-1 py-4 text-xl text-gray-600 hover:bg-gray-100 rounded-2xl font-bold bg-gray-200 transition-colors"
                                >
                                    取消
                                </button>
                                <button
                                    onClick={confirmPackOrder}
                                    className="flex-1 py-4 text-xl bg-blue-600 text-white hover:bg-blue-700 rounded-2xl font-bold shadow-lg transition-transform active:scale-95"
                                >
                                    確認
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showExitConfirm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-xl shadow-2xl max-w-sm w-full mx-4 animate-bounce-sm">
                        <h3 className="text-2xl font-bold text-gray-800 mb-4">確定要結束嗎？</h3>
                        <p className="text-xl text-gray-600 mb-8">目前的進度與分數將會遺失。</p>
                        <div className="flex gap-4 justify-end">
                            <button onClick={() => setShowExitConfirm(false)} className="px-6 py-3 text-lg text-gray-600 hover:bg-gray-100 rounded-xl font-medium bg-gray-200">取消</button>
                            <button onClick={() => { setGameState(GAME_STATE.IDLE); setShowExitConfirm(false); }} className="px-6 py-3 text-lg bg-red-600 text-white hover:bg-red-700 rounded-xl font-bold shadow-sm">確認結束</button>
                        </div>
                    </div>
                </div>
            )}

            <header className="bg-blue-600 text-white p-4 shadow-md flex justify-between items-center z-10 shrink-0">
                <div className="flex items-center gap-3"><ShoppingBag className="w-8 h-8" /><h1 className="text-2xl font-bold">便利商店外送模擬訓練</h1></div>
                <div className="flex items-center gap-6">
                    {gameState === GAME_STATE.PLAYING && (
                        <>
                            <div className="flex gap-4 font-mono text-xl">
                                <div className="bg-blue-700 px-5 py-2 rounded-lg flex items-center gap-2"><Clock className="w-6 h-6" /><span>{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</span></div>
                                <div className="bg-blue-700 px-5 py-2 rounded-lg">得分: {score}</div>
                                <div className="bg-red-600 px-5 py-2 rounded-lg flex items-center gap-2"><AlertCircle className="w-6 h-6" /> <span>{mistakes}</span></div>
                            </div>
                            <button onClick={() => setShowExitConfirm(true)} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm"><LogOut size={20} /> <span className="text-lg font-bold">結束</span></button>
                        </>
                    )}
                    {gameState !== GAME_STATE.PLAYING && (
                        <button onClick={() => setGameState(GAME_STATE.ADMIN)} className="bg-blue-500 hover:bg-blue-400 p-2 rounded-full transition-colors" title="進入後台設定">
                            <Settings size={28} />
                        </button>
                    )}
                </div>
            </header>

            {/* 重要：min-h-0，讓右側捲動區在 iOS Safari 正常工作 */}
            <main className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden relative">

                {/* 左側訂單區 */}
                <div className="w-full md:w-80 lg:w-96 shrink-0 h-[35%] md:h-full bg-slate-800 text-white p-4 flex flex-col overflow-y-auto border-b md:border-b-0 md:border-r border-slate-600 transition-all">
                    <h2 className="text-2xl font-bold mb-4 flex items-center gap-3 shrink-0"><div className={`w-4 h-4 rounded-full ${gameState === GAME_STATE.PLAYING ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></div>接單平板 ({orders.length})</h2>
                    <div className="space-y-4 pb-2">
                        {gameState === GAME_STATE.PLAYING && orders.length === 0 && (<div className="text-center text-slate-500 py-10 text-xl">等待新訂單...</div>)}
                        {orders.map(order => (
                            <div key={order.id} className={`bg-slate-700 rounded-xl p-4 border-l-8 ${order.platform === 'UberEats' ? 'border-green-500' : 'border-pink-500'} relative`}>
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <span className={`text-sm px-3 py-1 rounded-md font-bold ${order.platform === 'UberEats' ? 'bg-green-600' : 'bg-pink-600'}`}>{order.platform}</span>
                                        <span className="ml-3 text-2xl font-mono font-bold">#{order.id}</span>
                                    </div>
                                    {order.status === 'ready' && <span className="text-green-400 text-base font-bold animate-pulse">外送員已抵達</span>}
                                </div>

                                {order.status !== 'ready' && (
                                    <div className="w-full h-2 bg-slate-600 rounded-full mb-3 overflow-hidden">
                                        <div
                                            className={`h-full transition-all duration-1000 ${(Date.now() - order.createdAt) / 1000 / settings.orderTimeout > 0.8 ? 'bg-red-500'
                                                : (Date.now() - order.createdAt) / 1000 / settings.orderTimeout > 0.5 ? 'bg-yellow-500'
                                                    : 'bg-green-500'
                                                }`}
                                            style={{ width: `${Math.min(100, ((Date.now() - order.createdAt) / 1000 / settings.orderTimeout) * 100)}%` }}
                                        />
                                    </div>
                                )}

                                <div className="text-base text-slate-300 mb-4 flex flex-wrap gap-2">
                                    {order.items.map((item: any, idx: number) => (
                                        <div key={idx} className="bg-slate-600 rounded-lg pr-3 flex items-center overflow-hidden">
                                            <ItemDisplay item={item} size="sm" className="w-8 h-8 mr-2 rounded-none border-none" />
                                            <span className="text-base">{item.name}</span>
                                        </div>
                                    ))}
                                </div>

                                {order.status === 'pending' && (
                                    <button
                                        onClick={() => handleStartPicking(order.id)}
                                        disabled={activeOrderId !== null}
                                        className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white py-3 rounded-lg font-bold text-lg"
                                    >
                                        {activeOrderId ? '請先完成當前訂單' : '開始撿貨'}
                                    </button>
                                )}
                                {order.status === 'picking' && <div className="bg-yellow-600 text-white text-center py-3 rounded-lg font-bold text-lg">撿貨中...</div>}
                                {order.status === 'ready' && (
                                    <button
                                        onClick={() => handleDriverPickup(order.id)}
                                        className="w-full bg-green-600 hover:bg-green-500 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 animate-bounce-sm text-lg"
                                    >
                                        <Truck size={20} /> 核對單號並給餐
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* 右側撿貨區：重要 min-h-0，讓內部 scroll 生效 */}
                <div className="flex-1 min-w-0 min-h-0 flex flex-col p-4 md:p-6 bg-white relative overflow-hidden">
                    {feedback && (
                        <div className={`absolute top-6 left-1/2 transform -translate-x-1/2 px-8 py-4 rounded-full shadow-xl font-bold text-2xl z-50 animate-bounce ${feedback.type === 'success' ? 'bg-green-100 text-green-700 border-2 border-green-300' : 'bg-red-100 text-red-700 border-2 border-red-300'}`}>
                            {feedback.msg}
                        </div>
                    )}

                    {gameState === GAME_STATE.IDLE && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center space-y-8 bg-white z-40 overflow-y-auto p-4">
                            <div className="text-8xl">🏪</div>
                            <h2 className="text-4xl font-bold text-gray-800 text-center">準備好開始上班了嗎？</h2>
                            <div className="flex flex-wrap justify-center gap-6 text-gray-500 bg-gray-50 p-6 rounded-2xl">
                                <span className="flex items-center gap-2 text-xl"><Clock size={24} /> 遊戲時間: {settings.gameDuration}秒</span>
                                <span className="flex items-center gap-2 text-xl"><AlertCircle size={24} /> 訂單時限: {settings.orderTimeout}秒</span>
                            </div>
                            <button onClick={startGame} className="bg-blue-600 hover:bg-blue-700 text-white px-12 py-6 rounded-2xl text-3xl font-bold shadow-xl flex items-center gap-3 transform hover:scale-105 transition-transform">
                                <Play size={32} /> 開始上班
                            </button>
                        </div>
                    )}

                    {gameState === GAME_STATE.GAME_OVER && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center space-y-8 bg-white z-40 overflow-y-auto p-4">
                            <div className="text-8xl">🏁</div>
                            <h2 className="text-4xl font-bold text-gray-800 text-center">下班了！</h2>
                            <div className="bg-gray-100 p-10 rounded-2xl text-center min-w-[300px] md:min-w-[400px]">
                                <div className="text-xl text-gray-600 mb-3">本次得分</div>
                                <div className="text-6xl font-bold text-blue-600 mb-8">{score}</div>
                                <div className="flex justify-between text-lg text-gray-500 border-t pt-6">
                                    <span>難度: {settings.orderTimeout}s/單</span>
                                    <span>失誤: {mistakes}</span>
                                </div>
                            </div>
                            <button onClick={startGame} className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-5 rounded-xl font-bold flex items-center gap-3 text-2xl">
                                <RotateCcw size={28} /> 重新挑戰
                            </button>
                        </div>
                    )}

                    {gameState === GAME_STATE.PLAYING && activeOrder && (
                        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                            <div className="shrink-0 space-y-3 mb-4">
                                <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-4 md:p-5 flex flex-col md:flex-row justify-between items-center gap-3">
                                    <div>
                                        <h3 className="font-bold text-gray-700 flex items-center gap-3 text-xl">
                                            <Package size={28} /> 訂單: <span className="text-3xl text-blue-600">#{activeOrderId}</span>
                                        </h3>
                                        <p className="text-lg text-gray-500 mt-1 hidden md:block">請點擊下方商品進行撿貨</p>
                                    </div>

                                    <div className="flex gap-3 overflow-x-auto w-full md:w-auto p-1">
                                        {activeOrder.items.map((item: any, index: number) => {
                                            const pickedCount = pickedItems.filter(p => p.id === item.id).length;
                                            const currentItemIndexAmongSameType = activeOrder.items.slice(0, index + 1).filter((i: any) => i.id === item.id).length;
                                            const isPicked = pickedCount >= currentItemIndexAmongSameType;
                                            return (
                                                <div key={index} className={`flex flex-col items-center p-3 rounded-xl border-2 relative shrink-0 ${isPicked ? 'bg-green-100 border-green-300 opacity-50' : 'bg-white border-gray-300'}`}>
                                                    <ItemDisplay item={item} size="md" />
                                                    {isPicked && <CheckCircle className="w-8 h-8 text-green-600 absolute -top-3 -right-3 bg-white rounded-full z-10 shadow-sm" />}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <button
                                        onClick={handlePackOrder}
                                        className={`px-6 py-3 md:px-8 md:py-4 rounded-xl font-bold text-xl shadow-md transition-colors w-full md:w-auto ${pickedItems.length === activeOrder.items.length
                                            ? 'bg-blue-600 text-white hover:bg-blue-700 animate-pulse'
                                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                            }`}
                                    >
                                        打包
                                    </button>
                                </div>

                                <div className="flex gap-3 overflow-x-auto pb-3 px-1 mb-2 scrollbar-hide">
                                    {filterTabs.map(cat => (
                                        <button
                                            key={cat}
                                            onClick={() => setCurrentCategory(cat)}
                                            className={`px-6 py-3 rounded-full whitespace-nowrap text-base font-bold transition-colors border-2 ${currentCategory === cat
                                                ? 'bg-blue-600 text-white border-blue-600'
                                                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
                                                }`}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 貨架區：iPad Safari 硬修正 - 真正可捲動區 */}
                            <div
                                className="flex-1 min-h-0 bg-gray-50 border border-gray-200 rounded-2xl p-5 overflow-y-auto overscroll-contain"
                                style={{
                                    WebkitOverflowScrolling: 'touch',
                                    touchAction: 'pan-y'
                                } as React.CSSProperties}
                            >
                                <div className="flex justify-between items-center mb-6">
                                    <h4 className="text-gray-500 font-bold flex items-center gap-2 text-lg">
                                        <Filter size={20} /> 貨架區: <span className="text-blue-600">{currentCategory}</span>
                                    </h4>
                                    <span className="text-sm text-gray-400">顯示 {filteredInventory.length} 項商品</span>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 pb-32">
                                    {filteredInventory.map((item: any) => (
                                        <button
                                            key={item.id}
                                            onClick={() => handlePickItem(item)}
                                            className="bg-white border-2 border-gray-200 rounded-2xl p-4 hover:shadow-lg hover:border-blue-300 active:bg-blue-50 transition-all flex flex-col items-center justify-center gap-3 h-48 md:h-60"
                                        >
                                            <ItemDisplay item={item} size="lg" />
                                            <span className="font-bold text-gray-700 text-center text-xl line-clamp-2 leading-tight">{item.name}</span>
                                            <span className="text-sm text-gray-400 bg-gray-100 px-3 py-1 rounded-full hidden md:inline-block">{item.category}</span>
                                        </button>
                                    ))}
                                    {filteredInventory.length === 0 && (
                                        <div className="col-span-2 md:col-span-3 lg:col-span-4 text-center py-20 text-gray-400 text-xl">
                                            此分類沒有商品
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {gameState === GAME_STATE.PLAYING && !activeOrderId && (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-4">
                            <ShoppingBag className="w-24 h-24 mb-2 opacity-20" />
                            <p className="text-3xl font-medium">請從左側點選「開始撿貨」</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

// --- 5. 根組件 (Export) ---
export default function AppWrapper() {
    return (
        <ErrorBoundary>
            <GameApp />
        </ErrorBoundary>
    );
}
