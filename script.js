let stores = []; 
let products = []; 
let customers = []; 
let onlineOrders = []; 
let appCustomerCart = [];
let currentStoreId = null; 
let currentCategory = 'Tất cả'; 
let currentPaymentMethod = 'Tiền mặt'; 
let currentUserId = null; 

const formatMoney = (amount) => new Intl.NumberFormat('vi-VN').format(amount);

window.onload = () => { 
    loadStoresForCustomer(); 
};

// 🔥 HÀM TẢI DỮ LIỆU TỪ SERVER 🔥
async function loadData() {
    try {
        const res = await fetch('http://localhost:3000/api/products?storeId=' + currentStoreId); 
        products = await res.json(); 
        
        const resCus = await fetch('http://localhost:3000/api/customers?storeId=' + currentStoreId); 
        customers = await resCus.json();
        
        renderProducts(); 
        renderInventory(); 
        renderAppProducts(); 
        buildCategoryFilters(); 
        updateDashboard(); 
        renderCustomers(); 
        renderOnlineOrders();
    } catch (err) { 
        console.error("❌ Lỗi kết nối CSDL!", err); 
    }
}

// LƯU TÊN KHÁCH HÀNG ĐANG MUA TẠI QUẦY
function saveSession() { 
    const s = stores.find(s => s.id === currentStoreId); 
    if(s) s.customerName = document.getElementById('customerName').value; 
}

// BỘ LỌC DANH MỤC SẢN PHẨM TẠI QUẦY
function buildCategoryFilters() {
    const pStore = products.filter(p => !p.storeId || p.storeId === currentStoreId);
    const cats = ['Tất cả', ...new Set(pStore.map(p => p.category))];
    document.getElementById('categoryFilter').innerHTML = cats.map(c => 
        `<button onclick="setCategory('${c}')" class="cat-btn whitespace-nowrap px-5 py-2 rounded-xl text-xs font-bold btn-pop ${currentCategory === c ? 'fancy-gradient text-white' : 'bg-white text-gray-500'} shadow-sm border border-gray-200">${c}</button>`
    ).join('');
}

function setCategory(cat) { 
    currentCategory = cat; 
    buildCategoryFilters(); 
    renderProducts(); 
}

// 🔥 VẼ DANH SÁCH MẶT HÀNG TRONG POS 🔥
function renderProducts() {
    const list = document.getElementById('productList'); 
    const kw = document.getElementById('searchInput').value.toLowerCase();
    
    const filtered = products.filter(p => 
        (!p.storeId || p.storeId === currentStoreId) && 
        (currentCategory === 'Tất cả' || p.category === currentCategory) && 
        p.name.toLowerCase().includes(kw)
    );
    
    list.innerHTML = filtered.map(p => {
        const out = p.stock <= 0;
        return `
        <div onclick="${out ? '' : `addToCart(${p.id})`}" class="card-modern bg-white p-4 text-center cursor-pointer relative group ${out ? 'opacity-50 grayscale' : ''}">
            <div class="text-5xl mb-3 group-hover:scale-110 transition">${p.img}</div>
            <div class="text-[11px] font-bold text-gray-700 h-8 line-clamp-2 leading-tight">${p.name}</div>
            <div class="text-emerald-600 font-black text-sm mt-2">${formatMoney(p.price)}đ</div>
            <div class="absolute top-2 right-2 text-[9px] font-bold px-2 py-1 rounded-lg ${out ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-gray-400'}">${out ? 'HẾT' : `Kho: ${p.stock}`}</div>
        </div>`;
    }).join('');
}

// 🔥 THÊM VÀO GIỎ HÀNG TẠI QUẦY (ĐÃ FIX TRỪ KHO REAL-TIME) 🔥
function addToCart(id) { 
    const s = stores.find(x => x.id === currentStoreId); 
    if(!s) return; 
    
    const p = products.find(x => x.id === id); 
    if (p.stock <= 0) {
        alert('Sếp ơi, mặt hàng này trong kho đã hết rồi!');
        return;
    }

    const item = s.cart.find(x => x.id === id); 
    if(item) { 
        item.qty++; // Tăng trong giỏ
    } else { 
        s.cart.push({...p, qty: 1}); // Mới thêm vào giỏ
    }
    
    p.stock--; // 🚀 Trừ trực tiếp vào kho ảo để hiển thị
    
    renderCart(); 
    renderProducts(); // 🚀 Vẽ lại màn hình để kho bên trái tụt xuống
}

// 🔥 VẼ GIỎ HÀNG BÊN PHẢI (POS) 🔥
function renderCart() { 
    const s = stores.find(x => x.id === currentStoreId); 
    if(!s) return;
    
    const list = document.getElementById('cartList'); 
    const empty = document.getElementById('emptyCartMsg');
    
    if(s.cart.length === 0) { 
        empty.style.display = 'flex'; 
        list.innerHTML = ''; 
    } else { 
        empty.style.display = 'none'; 
        list.innerHTML = s.cart.map(item => `
        <tr class="border-b last:border-0 hover:bg-slate-50 transition">
            <td class="py-4 text-xs font-bold text-gray-800 w-1/2 leading-tight pr-2">${item.name}</td>
            <td class="py-4 text-center">
                <div class="flex items-center justify-center space-x-2 bg-slate-100 rounded-full p-1 w-max mx-auto">
                    <button onclick="updateQty(${item.id},-1)" class="w-6 h-6 bg-white rounded-full font-black text-gray-500 hover:text-rose-500 shadow-sm">-</button>
                    <span class="text-xs font-black w-4 text-gray-800">${item.qty}</span>
                    <button onclick="updateQty(${item.id},1)" class="w-6 h-6 bg-emerald-500 text-white rounded-full font-black hover:bg-emerald-600 shadow-sm">+</button>
                </div>
            </td>
            <td class="py-4 text-right font-black text-emerald-600 text-sm pl-2">${formatMoney(item.price*item.qty)}</td>
        </tr>`).join(''); 
    }
    calculateTotal();
}

// 🔥 NÚT TĂNG GIẢM SỐ LƯỢNG TRONG GIỎ (ĐÃ FIX TRỪ/CỘNG KHO LẠI) 🔥
function updateQty(id, d) { 
    const s = stores.find(x => x.id === currentStoreId); 
    if(!s) return; 
    
    const item = s.cart.find(i => i.id === id); 
    const p = products.find(x => x.id === id);

    if (item) { 
        if (d > 0) {
            // Tăng số lượng (+)
            if (p.stock > 0) {
                item.qty++;
                p.stock--;
            } else {
                alert('Sếp ơi, mặt hàng này trong kho đã hết!');
            }
        } else {
            // Giảm số lượng (-)
            item.qty--;
            p.stock++; // Trả lại kho
            if (item.qty <= 0) {
                s.cart = s.cart.filter(i => i.id !== id);
            }
        }
        renderCart(); 
        renderProducts(); // 🚀 Cập nhật lại kho bên trái
    } 
}

function calculateTotal() { 
    const s = stores.find(x => x.id === currentStoreId); 
    if(!s) return; 
    const total = s.cart.reduce((sum, i) => sum + (i.price*i.qty), 0); 
    document.getElementById('subTotal').innerText = formatMoney(total)+'đ'; 
    document.getElementById('finalTotal').innerText = formatMoney(total)+'đ'; 
}

// ĐỔI PHƯƠNG THỨC THANH TOÁN
function setPayment(m) { 
    currentPaymentMethod = m === 'cash' ? "Tiền mặt" : "Mã QR";
    document.getElementById('btnPayCash').className = m === 'cash' ? "btn-3d flex-1 py-3.5 bg-emerald-50 border-2 border-emerald-500 text-emerald-700 rounded-xl font-bold text-xs shadow-sm border-b-4 border-b-emerald-600" : "btn-3d flex-1 py-3.5 bg-slate-100 text-gray-600 rounded-xl font-bold text-xs border-b-4 border-slate-300 hover:bg-slate-200";
    document.getElementById('btnPayQR').className = m === 'qr' ? "btn-3d flex-1 py-3.5 bg-emerald-50 border-2 border-emerald-500 text-emerald-700 rounded-xl font-bold text-xs shadow-sm border-b-4 border-b-emerald-600" : "btn-3d flex-1 py-3.5 bg-slate-100 text-gray-600 rounded-xl font-bold text-xs border-b-4 border-slate-300 hover:bg-slate-200";
}

// 🔥 NÚT BẤM THANH TOÁN TẠI QUẦY 🔥
function checkout() {
    const s = stores.find(x => x.id === currentStoreId); 
    if(!s) return;
    
    if(s.cart.length === 0) return alert('Giỏ hàng trống!');
    
    const rev = s.cart.reduce((sum, i) => sum + (i.price*i.qty), 0);
    s.revOffline += rev; 
    s.orders++;
    
    // GỬI LÊN LÀ ĐƠN 'OFFLINE'
    updateCustomer(document.getElementById('customerName').value, rev, '', 'offline');
    
    // Dữ liệu In Bill
    document.getElementById('billStoreName').innerText = document.getElementById('headerStoreName').innerText; 
    document.getElementById('billDate').innerText = new Date().toLocaleString('vi-VN'); 
    document.getElementById('billCustomer').innerText = document.getElementById('customerName').value; 
    document.getElementById('billTotal').innerText = formatMoney(rev)+'đ';
    document.getElementById('billItems').innerHTML = s.cart.map(i => `<tr><td class="py-2 text-gray-800 font-bold">${i.name}</td><td class="text-center py-2">x${i.qty}</td><td class="text-right font-black py-2">${formatMoney(i.price*i.qty)}</td></tr>`).join('');
    
    if(currentPaymentMethod === 'Mã QR') { 
        document.getElementById('qrImage').src = `https://api.qrserver.com/v1/create-qr-code/?data=KHANHVAN_POS_${rev}&size=200x200`; 
        document.getElementById('qrContainer').classList.remove('hidden'); 
    } else {
        document.getElementById('qrContainer').classList.add('hidden');
    }
    
    document.getElementById('receiptModal').classList.remove('hidden');
}

// 🔥 ĐÓNG BILL & LƯU DB LÊN SERVER 🔥
async function closeReceipt() { 
    const s = stores.find(x => x.id === currentStoreId); 
    if(!s) return;
    
    const total = s.cart.reduce((sum, i) => sum + (i.price*i.qty), 0); 
    const orderCode = 'HD' + Date.now();
    
    try {
        await fetch('http://localhost:3000/api/update-stock', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ cart: s.cart }) 
        });
        await fetch('http://localhost:3000/api/save-order', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ order_code: orderCode, customer_name: document.getElementById('customerName').value, total_amount: total, storeId: currentStoreId }) 
        });
    } catch(err) { 
        console.log("Lỗi mạng khi lưu Data!", err); 
    }
    
    // ❌ KHÔNG TRỪ KHO ĐÚP Ở ĐÂY NỮA VÌ ĐÃ TRỪ TRONG HÀM ADDTOCART ❌
    
    s.cart = []; 
    document.getElementById('receiptModal').classList.add('hidden'); 
    renderCart(); 
    renderProducts(); 
    renderInventory(); 
    updateDashboard();
}

// LƯU DATA KHÁCH HÀNG
async function updateCustomer(n, a, phone = '', orderType = 'offline') { 
    if(!n || n==='Khách lẻ') return;
    await fetch('http://localhost:3000/api/update-customer', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ phone: phone, name: n, spent: a, storeId: currentStoreId, orderType: orderType }) 
    });
    
    const resCus = await fetch('http://localhost:3000/api/customers?storeId=' + currentStoreId); 
    customers = await resCus.json(); 
    renderCustomers(); 
}

// VẼ BẢNG KHÁCH HÀNG CRM
function renderCustomers() {
    const list = document.getElementById('customersList');
    const sorted = [...customers].sort((a,b) => b.spent - a.spent);
    
    if(list) list.innerHTML = sorted.map(c => `
        <tr class="border-b hover:bg-slate-50 transition">
            <td class="p-4 font-bold text-gray-800">${c.name}</td>
            <td class="p-4 text-center"><span class="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-black" title="Đơn mua tại cửa hàng">${c.offline_orders || 0}</span></td>
            <td class="p-4 text-center"><span class="px-3 py-1 bg-purple-50 text-purple-600 rounded-lg text-xs font-black" title="Đơn đặt qua mạng">${c.online_orders || 0}</span></td>
            <td class="p-4 text-right font-black text-emerald-600">${formatMoney(c.spent)}đ</td>
        </tr>`).join('');
        
    const topList = document.getElementById('topCustomersList');
    if(topList) topList.innerHTML = sorted.slice(0,5).map((c, i) => `
        <tr class="border-b last:border-0 hover:bg-slate-50">
            <td class="py-4 text-center text-gray-400 font-black text-xs">${i+1}</td>
            <td class="py-4 font-bold text-gray-800">${c.name}</td>
            <td class="py-4 text-center font-bold text-gray-500">${c.offline_orders || 0}</td>
            <td class="py-4 text-center font-bold text-gray-500">${c.online_orders || 0}</td>
            <td class="py-4 text-right font-black text-emerald-600">${formatMoney(c.spent)}đ</td>
        </tr>`).join('');
        
    const dataList = document.getElementById('customerDataList');
    if(dataList) dataList.innerHTML = customers.map(c => `<option value="${c.name}">`).join('');
}

// VẼ KHO HÀNG
function renderInventory() {
    const list = document.getElementById('inventoryList');
    if(list) {
        list.innerHTML = products.filter(p => !p.storeId || p.storeId === currentStoreId).map(p => `
        <tr class="border-b hover:bg-slate-50 transition">
            <td class="p-4 font-bold flex items-center text-gray-800"><span class="text-3xl mr-3 bg-white shadow-sm p-1 rounded-xl border border-gray-100">${p.img}</span> <div class="leading-tight">${p.name}<br><span class="text-[10px] text-gray-400 font-medium uppercase tracking-widest">${p.category}</span></div></td>
            <td class="p-4 font-bold text-gray-500">${formatMoney(p.cost || 0)}đ</td>
            <td class="p-4 font-black text-emerald-600">${formatMoney(p.price)}đ</td>
            <td class="p-4 text-center">
                <div class="flex items-center justify-center space-x-2 bg-slate-100 rounded-full w-max mx-auto p-1">
                    <button onclick="quickUpdateStock(${p.id}, -1)" class="w-8 h-8 flex items-center justify-center bg-white text-gray-600 rounded-full hover:text-rose-500 transition font-black active:scale-90 shadow-sm"><i class="fa-solid fa-minus text-xs"></i></button>
                    <span class="w-10 font-black text-lg ${p.stock < 5 ? 'text-rose-500' : 'text-gray-800'}">${p.stock}</span>
                    <button onclick="quickUpdateStock(${p.id}, 1)" class="w-8 h-8 flex items-center justify-center bg-white text-gray-600 rounded-full hover:text-emerald-500 transition font-black active:scale-90 shadow-sm"><i class="fa-solid fa-plus text-xs"></i></button>
                </div>
            </td>
        </tr>`).join('');
    }
}

// CẬP NHẬT KHO NHANH (QUICK ACTION)
async function quickUpdateStock(id, change) {
    try {
        const res = await fetch('http://localhost:3000/api/quick-update-stock', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ productId: id, change: change }) 
        });
        const data = await res.json();
        
        if(data.success) { 
            const p = products.find(x => x.id === id); 
            if(p) { 
                p.stock += change; 
                if(p.stock < 0) p.stock = 0; 
            } 
            renderInventory(); 
            renderProducts(); 
            renderAppProducts(); 
        } else { 
            alert('❌ Lỗi không thể cập nhật kho!'); 
        }
    } catch(e) { 
        alert('❌ Máy chủ không phản hồi!'); 
    }
}

// CẬP NHẬT DASHBOARD
function updateDashboard() { 
    const s = stores.find(x => x.id === currentStoreId); if(!s) return;
    
    // Tính tổng doanh thu từ DB khách hàng cho chuẩn
    const realTotalRev = customers.reduce((sum, c) => sum + c.spent, 0); 
    
    // Lợi nhuận tạm tính
    const estimatedProfit = realTotalRev * 0.3;
    
    const d1 = document.getElementById('dashTotalRev'); if(d1) d1.innerText = formatMoney(realTotalRev)+'đ'; 
    const d2 = document.getElementById('dashOfflineRev'); if(d2) d2.innerText = formatMoney(realTotalRev - s.revOnline)+'đ'; 
    const d3 = document.getElementById('dashOnlineRev'); if(d3) d3.innerText = formatMoney(s.revOnline)+'đ'; 
    const d4 = document.getElementById('dashProfit'); if(d4) d4.innerText = formatMoney(estimatedProfit)+'đ'; 
}

function openProductModal() { 
    document.getElementById('addProductModal').classList.remove('hidden'); 
}

async function saveProduct() { 
    const name = document.getElementById('newPName').value.trim(); 
    const category = document.getElementById('newPCat').value.trim() || 'Chung'; 
    const cost = parseInt(document.getElementById('newPCost').value) || 0; 
    const price = parseInt(document.getElementById('newPPrice').value) || 0; 
    const stock = parseInt(document.getElementById('newPStock').value) || 0; 
    const img = document.getElementById('newPIcon').value.trim() || '📦';
    
    if(!name || !price) return alert('⚠ Vui lòng nhập ít nhất Tên và Giá bán!');
    
    try {
        const res = await fetch('http://localhost:3000/api/add-product', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ name, category, cost, price, stock, img, storeId: currentStoreId }) 
        });
        const data = await res.json();
        
        if(data.success) { 
            alert("✅ Sản phẩm đã được lưu vĩnh viễn."); 
            document.getElementById('addProductModal').classList.add('hidden'); 
            loadData(); 
            ['newPName','newPPrice','newPCost','newPStock','newPCat','newPIcon'].forEach(id => {
                const el = document.getElementById(id);
                if(el) el.value = '';
            }); 
        }
    } catch (err) { 
        alert("❌ Lỗi kết nối server!"); 
    }
}

// ---------------- CÁC HÀM UI CƠ BẢN ----------------

function changeRole(r) { 
    document.getElementById('appBody').className = 'role-' + r;
    if(r === 'customer') { switchTab('storefront'); } else { switchTab(r === 'admin' ? 'dashboard' : 'pos'); }
}

function switchTab(tabId) { 
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active')); 
    const target = document.getElementById('tab-' + tabId); 
    if(target) target.classList.add('active'); 
    
    document.querySelectorAll('.menu-btn').forEach(btn => btn.classList.remove('active-tab')); 
    const activeBtn = document.getElementById('btn-' + tabId); 
    if(activeBtn) activeBtn.classList.add('active-tab');
}

let isSysRegisterMode = false;

// 🔥 ĐĂNG NHẬP / ĐĂNG KÝ HỆ THỐNG TỪ APP.HTML 🔥
async function systemAuth() {
    const user = document.getElementById('sysUsername').value.trim(); 
    const pass = document.getElementById('sysPassword').value.trim(); 
    const errDiv = document.getElementById('sysLoginError');
    
    if(!user || !pass) { 
        errDiv.className = "text-red-500 text-xs font-black mb-4 bg-red-50 py-3 px-4 rounded-xl border border-red-200"; 
        errDiv.innerText = "⚠ Vui lòng nhập đủ tài khoản và mật khẩu!"; 
        errDiv.classList.remove('hidden'); 
        return; 
    }
    
    try {
        const res = await fetch(`http://localhost:3000/api/login`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ username: user, password: pass }) 
        }); 
        const data = await res.json();
        
        if(data.success) {
            currentStoreId = data.storeId; 
            currentUserId = data.userId; 
            const userRole = data.role || 'admin'; 
            document.getElementById('appBody').className = 'role-' + userRole;
            
            const displayStoreName = data.storeName || "Chi nhánh " + currentStoreId; 
            
            const hName = document.getElementById('headerStoreName'); if(hName) hName.innerText = displayStoreName; 
            const dName = document.getElementById('dashStoreName'); if(dName) dName.innerText = displayStoreName;
            
            const roleText = userRole === 'superadmin' ? "Quản Trị Tổng" : (userRole === 'admin' ? "Chủ Cửa Hàng" : "Nhân Viên"); 
            const uName = document.getElementById('headerUserName'); if(uName) uName.innerText = user.toUpperCase() + " (" + roleText + ")";
            
            if(data.avatarUrl) { 
                const avatarImg = document.getElementById('headerAvatarImg'); 
                if(avatarImg) avatarImg.src = 'http://localhost:3000' + data.avatarUrl; 
            }
            
            document.getElementById('systemLoginModal').classList.add('hidden');
            
            if(userRole === 'superadmin') { 
                switchTab('superadmin'); 
                loadSuperAdminData(); 
                applyStoreTheme('SYSTEM', 'superadmin'); 
            } else { 
                if(!stores.find(s => s.id === currentStoreId)) { 
                    stores.push({ id: currentStoreId, name: displayStoreName, revOffline: 0, revOnline: 0, profit: 0, orders: 0, cart: [], customerName: 'Khách lẻ' }); 
                } 
                loadData(); 
                switchTab(userRole === 'admin' ? 'dashboard' : 'pos'); 
                applyStoreTheme(currentStoreId, 'admin'); 
            }
        } else {
            if(data.isSuspended) { 
                errDiv.className = "text-white text-center font-black mb-4 bg-rose-500 py-6 px-4 rounded-2xl border-4 border-rose-700 shadow-xl animate-pulse"; 
                errDiv.innerHTML = `<i class="fa-solid fa-user-lock text-5xl mb-3"></i><br><span class="text-xl uppercase">TÀI KHOẢN BỊ CẤM</span><br><span class="text-[11px] font-bold mt-2 block opacity-90">Vui lòng liên hệ TỔNG ĐÀI ĐIỀU HÀNH (Đặng văn khánh) để được hỗ trợ!</span>`; 
            } else { 
                errDiv.className = "text-red-500 text-xs font-black mb-4 bg-red-50 py-3 px-4 rounded-xl border border-red-200"; 
                errDiv.innerText = "⚠ " + data.message; 
            } 
            errDiv.classList.remove('hidden');
        }
    } catch (error) { 
        errDiv.className = "text-red-500 text-xs font-black mb-4 bg-red-50 py-3 px-4 rounded-xl border border-red-200"; 
        errDiv.innerText = "⚠ Lỗi kết nối CSDL MySQL!"; 
        errDiv.classList.remove('hidden'); 
    }
}

function systemLogout() {
    if(!confirm("🤔 Bạn có chắc muốn Đăng xuất hệ thống?")) return; 
    document.getElementById('systemLoginModal').classList.remove('hidden');
    currentStoreId = null; 
    currentUserId = null; 
    document.getElementById('sysPassword').value = ''; 
    loadStoresForCustomer();
}

async function uploadAvatar() {
    const input = document.getElementById('avatarInput'); 
    if(!input.files || input.files.length === 0) return;
    
    const file = input.files[0]; 
    const formData = new FormData(); 
    formData.append('avatar', file); 
    formData.append('userId', currentUserId);
    
    try { 
        const res = await fetch('http://localhost:3000/api/upload-avatar', { method: 'POST', body: formData }); 
        const data = await res.json(); 
        if(data.success) { 
            document.getElementById('headerAvatarImg').src = 'http://localhost:3000' + data.avatarUrl; 
        } else {
            alert("❌ Lỗi: " + data.message); 
        }
    } catch (error) { 
        alert("❌ Không thể kết nối server để tải ảnh!"); 
    }
}

// ---------------- KHÁCH HÀNG MUA ONLINE ----------------

async function loadStoresForCustomer() { 
    try { 
        const res = await fetch('http://localhost:3000/api/all-stores'); 
        const storeList = await res.json(); 
        const selector = document.getElementById('cusStoreSelector'); 
        if(selector && storeList.length > 0) { 
            selector.innerHTML = storeList.map(s => `<option value="${s.storeId}">${s.storeName}</option>`).join(''); 
        } 
    } catch (err) { 
        console.error("Lỗi tải chi nhánh khách:", err); 
    } 
}

function enterCustomerMode() {
    const selector = document.getElementById('cusStoreSelector'); 
    if(!selector || !selector.value) return alert("Vui lòng chọn chi nhánh!");
    
    currentStoreId = selector.value; 
    const sName = selector.options[selector.selectedIndex].text; 
    changeRole('customer'); 
    document.getElementById('systemLoginModal').classList.add('hidden');
    
    if(!stores.find(s => s.id === currentStoreId)) { 
        stores.push({ id: currentStoreId, name: sName, revOffline: 0, revOnline: 0, profit: 0, orders: 0, cart: [], customerName: 'Khách lẻ' }); 
    }
    
    const desc = document.getElementById('storefrontDesc'); 
    if(desc) desc.innerText = "Giao hàng từ chi nhánh: " + sName; 
    
    loadData(); 
    applyStoreTheme(currentStoreId, 'customer'); 
}

function renderAppProducts() {
    const list = document.getElementById('appProductList'); if(!list) return; 
    const kw = document.getElementById('appSearchInput').value.toLowerCase();
    
    list.innerHTML = products.filter(p => (!p.storeId || p.storeId === currentStoreId) && p.name.toLowerCase().includes(kw) && p.stock > 0).map(p => `
        <div class="card-modern bg-white p-4 text-center group border border-gray-100 hover:border-emerald-500">
            <div class="text-6xl mb-4 group-hover:scale-110 transition">${p.img}</div>
            <div class="font-black text-sm text-gray-800 line-clamp-1">${p.name}</div>
            <div class="text-emerald-600 font-black my-3 text-lg">${formatMoney(p.price)}đ</div>
            <button onclick="addToAppCart(${p.id})" class="btn-3d w-full bg-emerald-50 text-emerald-600 py-3 rounded-xl font-black border-b-4 border-emerald-200 hover:bg-emerald-100">+ Đặt ngay</button>
        </div>`).join('');
}

function addToAppCart(id) { 
    const p = products.find(x => x.id === id); 
    const item = appCustomerCart.find(x => x.id === id); 
    
    if (item) { 
        if(item.qty < p.stock) item.qty++; 
        else alert('Mặt hàng này đã hết!'); 
    } else { 
        appCustomerCart.push({...p, qty: 1}); 
    } 
    renderAppCart(); 
    
    const badge = document.getElementById('appCartBadge'); 
    if(badge) {
        badge.innerText = appCustomerCart.reduce((sum, i) => sum + i.qty, 0); 
        badge.classList.remove('hidden');
    }
}

function openCustomerCart() { 
    document.getElementById('customerCartModal').classList.remove('hidden'); 
    renderAppCart(); 
}

function renderAppCart() {
    const list = document.getElementById('appCartItems'); if(!list) return;
    
    if(appCustomerCart.length === 0) { 
        list.innerHTML = '<div class="text-center text-gray-400 mt-10 font-bold"><i class="fa-solid fa-basket-shopping text-4xl mb-3 block"></i>Giỏ hàng đang trống</div>'; 
    } else { 
        list.innerHTML = appCustomerCart.map(item => `
            <div class="flex justify-between items-center mb-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                <div class="font-black text-sm w-1/2 text-gray-800">${item.name}</div>
                <div class="flex items-center space-x-3 bg-slate-100 rounded-full p-1 border border-slate-200">
                    <button onclick="updateAppQty(${item.id},-1)" class="w-7 h-7 bg-white rounded-full font-black hover:text-rose-500 shadow-sm">-</button>
                    <span class="font-black text-sm w-4 text-center">${item.qty}</span>
                    <button onclick="updateAppQty(${item.id},1)" class="w-7 h-7 bg-emerald-500 text-white rounded-full font-black hover:bg-emerald-600 shadow-sm">+</button>
                </div>
                <div class="font-black text-emerald-600 text-sm">${formatMoney(item.price*item.qty)}đ</div>
            </div>`).join(''); 
    }
    const totalEl = document.getElementById('appCartTotal'); 
    if(totalEl) totalEl.innerText = formatMoney(appCustomerCart.reduce((sum, item) => sum + (item.price * item.qty), 0)) + 'đ';
}

function updateAppQty(id, d) { 
    const item = appCustomerCart.find(i => i.id === id); 
    const p = products.find(x => x.id === id); 
    if (item) { 
        item.qty += d; 
        if (item.qty <= 0) appCustomerCart = appCustomerCart.filter(i => i.id !== id); 
        else if (item.qty > p.stock) item.qty = p.stock; 
        
        renderAppCart(); 
        
        const badge = document.getElementById('appCartBadge'); 
        if(badge) {
            const count = appCustomerCart.reduce((sum, i) => sum + i.qty, 0);
            badge.innerText = count;
            if(count === 0) badge.classList.add('hidden');
        }
    } 
}

function submitCustomerOrder() {
    const name = document.getElementById('appCusName').value.trim(); 
    const phone = document.getElementById('appCusPhone').value.trim();
    
    if(appCustomerCart.length === 0) return alert("Giỏ hàng trống, hãy chọn món trước!"); 
    if (!/^[a-zA-ZÀ-ỹ\s]+$/.test(name)) return alert("Tên chỉ được nhập chữ!"); 
    if (!/^[0-9]+$/.test(phone) || phone.length < 10) return alert("Số điện thoại không hợp lệ (Ít nhất 10 số)!");
    
    const total = appCustomerCart.reduce((sum, i) => sum + (i.price * i.qty), 0);
    onlineOrders.unshift({ 
        id: 'ONL' + Math.floor(1000 + Math.random() * 9000), 
        customerName: name, 
        phone, 
        total, 
        items: [...appCustomerCart], 
        status: 'Chờ duyệt', 
        storeId: currentStoreId 
    });
    
    appCustomerCart = []; 
    const badge = document.getElementById('appCartBadge'); 
    if(badge) badge.classList.add('hidden'); 
    
    document.getElementById('customerCartModal').classList.add('hidden'); 
    renderOnlineOrders(); 
    alert('🎉 Đặt hàng thành công!\nĐơn của bạn đã được gửi đến thu ngân. Vui lòng chờ nhận hàng nhé!');
    document.getElementById('appCusName').value = '';
    document.getElementById('appCusPhone').value = '';
}

// ---------------- DUYỆT ĐƠN ONLINE & BOSS ----------------

function renderOnlineOrders() {
    const filtered = onlineOrders.filter(o => o.storeId === currentStoreId); 
    const list = document.getElementById('onlineOrdersList');
    if(list) {
        list.innerHTML = filtered.map(o => `
        <tr class="border-b hover:bg-slate-50 transition">
            <td class="p-5 font-black text-blue-600">#${o.id}</td>
            <td class="p-5 text-sm font-bold text-gray-800">${o.customerName}<br><span class="text-[11px] text-gray-400 font-medium"><i class="fa-solid fa-phone mr-1 text-gray-300"></i> ${o.phone}</span></td>
            <td class="p-5 text-right font-black text-emerald-600 text-lg">${formatMoney(o.total)}đ</td>
            <td class="p-5 text-center">
                ${o.status === 'Chờ duyệt' ? `<button onclick="approveOnlineOrder('${o.id}')" class="btn-3d bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-xs font-black shadow border-b-4 border-emerald-700 hover:bg-emerald-400"><i class="fa-solid fa-check mr-1"></i> DUYỆT ĐƠN</button>` : `<span class="bg-emerald-50 text-emerald-600 px-4 py-1.5 rounded-full font-black text-xs border border-emerald-200"><i class="fa-solid fa-check-double mr-1"></i> Xong</span>`}
            </td>
        </tr>`).join('');
    }
    
    const pending = onlineOrders.filter(o => o.status === 'Chờ duyệt' && o.storeId === currentStoreId).length; 
    const badge = document.getElementById('onlineBadge'); 
    if(badge) { 
        badge.innerText = pending; 
        badge.style.display = pending > 0 ? 'flex' : 'none'; 
    }
}

async function approveOnlineOrder(id) {
    const o = onlineOrders.find(x => x.id === id); 
    const s = stores.find(x => x.id === currentStoreId); 
    o.status = 'Hoàn thành';
    
    if(s) { 
        s.revOnline += o.total; 
        s.orders++; 
        o.items.forEach(item => { 
            const p = products.find(prod => prod.id === item.id); 
            if(p) { 
                p.stock -= item.qty; 
                s.profit += (item.price - item.cost) * item.qty; 
            } 
        }); 
    }
    
    // GỬI LÊN LÀ ĐƠN 'ONLINE'
    await updateCustomer(o.customerName, o.total, o.phone, 'online'); 
    
    renderOnlineOrders(); 
    renderInventory(); 
    updateDashboard();
}

function switchLoginView(view) {
    document.getElementById('sysLoginError').classList.add('hidden');
    if (view === 'customer') { 
        document.getElementById('formAdminLogin').classList.add('hidden'); 
        document.getElementById('formCustomerLogin').classList.remove('hidden'); 
    } else { 
        document.getElementById('formCustomerLogin').classList.add('hidden'); 
        document.getElementById('formAdminLogin').classList.remove('hidden'); 
    }
}

// ---------------- HỆ THỐNG CỦA SUPER ADMIN (BOSS) ----------------

async function toggleStoreStatus(storeId, currentStatus, storeName) {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active'; 
    const actionText = newStatus === 'suspended' ? 'ĐÌNH CHỈ' : 'MỞ KHÓA';
    
    if(!confirm(`⚠️ CẢNH BÁO BOSS: Boss có chắc chắn muốn ${actionText} cơ sở ${storeName} không?`)) return;
    
    try { 
        await fetch('http://localhost:3000/api/superadmin/toggle-status', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ storeId, status: newStatus }) 
        }); 
        alert(`✅ Đã ${actionText} thành công chi nhánh ${storeName}!`); 
        loadSuperAdminData(); 
    } catch (e) { 
        alert("Lỗi kết nối Máy chủ Tổng đài!"); 
    }
}

async function loadSuperAdminData() {
    try {
        const res = await fetch('http://localhost:3000/api/superadmin/stores-real'); 
        const data = await res.json(); 
        const list = document.getElementById('superAdminStoreList');
        
        let totalPlatformRev = 0; 
        let totalCus = 0; 
        
        if(list && Array.isArray(data)) {
            list.innerHTML = data.map((s) => {
                const rev = Number(s.realRevenue) || 0; 
                const cus = Number(s.realCustomers) || 0; 
                totalPlatformRev += rev; 
                totalCus += cus;
                const isActive = s.status !== 'suspended';
                
                const statusBadge = isActive ? `<span class="px-3 py-1.5 bg-emerald-900/50 text-emerald-400 rounded-lg text-[10px] font-black border border-emerald-800"><i class="fa-solid fa-circle-check mr-1"></i> HOẠT ĐỘNG</span>` : `<span class="px-3 py-1.5 bg-rose-900/50 text-rose-400 rounded-lg text-[10px] font-black border border-rose-800 animate-pulse"><i class="fa-solid fa-lock mr-1"></i> ĐÌNH CHỈ</span>`;
                const actionBtn = isActive ? `<button onclick="toggleStoreStatus('${s.storeId}', 'active', '${s.storeName}')" class="bg-rose-500/10 text-rose-500 px-4 py-2 rounded-xl text-[10px] font-black hover:bg-rose-600 hover:text-white transition border border-rose-500/30"><i class="fa-solid fa-ban mr-1"></i> ĐÌNH CHỈ</button>` : `<button onclick="toggleStoreStatus('${s.storeId}', 'suspended', '${s.storeName}')" class="bg-emerald-500/10 text-emerald-500 px-4 py-2 rounded-xl text-[10px] font-black hover:bg-emerald-600 hover:text-white transition border border-emerald-500/30"><i class="fa-solid fa-unlock mr-1"></i> MỞ KHÓA</button>`;
                
                return `<tr class="border-b border-slate-700 hover:bg-slate-800 transition ${!isActive ? 'opacity-50' : ''}">
                    <td class="p-4 font-black text-emerald-500">#${s.storeId}</td>
                    <td class="p-4 font-bold text-white">${s.storeName || 'Cửa hàng chưa đặt tên'}<div class="text-[10px] text-slate-400 mt-1 uppercase tracking-widest"><i class="fa-solid fa-users text-slate-500 mr-1"></i> Khách hàng: ${cus}</div></td>
                    <td class="p-4 text-slate-400 font-bold"><i class="fa-solid fa-user-shield mr-2 text-blue-500"></i>${s.username}</td>
                    <td class="p-4 text-right font-black text-blue-400 text-lg">${formatMoney(rev)}đ</td>
                    <td class="p-4 text-center">${statusBadge}</td>
                    <td class="p-4 text-center">${actionBtn}</td>
                </tr>`
            }).join('');
        }
        
        document.getElementById('saTotalStores').innerText = data.length || 0; 
        document.getElementById('saTotalRev').innerText = formatMoney(totalPlatformRev) + 'đ'; 
        document.getElementById('saTotalCus').innerText = formatMoney(totalCus); 
        document.getElementById('saPlatformFee').innerText = formatMoney(totalPlatformRev * 0.05) + 'đ'; 
    } catch(e) { 
        console.error("Lỗi tải Data Boss:", e); 
    }
}

// ĐỔI MÀU GIAO DIỆN TÙY THEO CHI NHÁNH HOẶC BOSS
function applyStoreTheme(storeId, role) {
    const mainEl = document.querySelector('main'); if(!mainEl) return;
    if(role === 'superadmin') { 
        mainEl.style.backgroundColor = '#0f172a'; // Nền xanh đen cho Boss
        mainEl.style.backgroundImage = 'url("https://www.transparenttextures.com/patterns/stardust.png")'; 
    } else {
        mainEl.style.backgroundColor = '#f8fafc'; // Nền xám nhạt sáng sủa cho thu ngân
        mainEl.style.backgroundImage = 'none';
    }
}