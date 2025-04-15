const ADMIN_CREDENTIALS = { email: 'admin@gmail.com', password: '1234' };
const PRICING = { bw: 2, color: 10, paperSizes: { A4: 2, A3: 5, A2: 10, A1: 20 }, serviceFee: 10 };
let centers = JSON.parse(localStorage.getItem('printingCenters')) || [];
let currentPrintJob = JSON.parse(localStorage.getItem('currentPrintJob')) || { 
    center: null, 
    files: [], 
    settings: { color: 'bw', size: 'A4', copies: 1, orientation: 'portrait' }
};

document.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    
    if (window.location.pathname.includes('login.html') || window.location.pathname.includes('register.html')) {
        if (user) window.location.href = 'home.html';
    } else if (!user) {
        window.location.href = 'login.html';
    }

    if (window.location.pathname.includes('admin.html')) renderCenters();
    if (window.location.pathname.includes('home.html')) renderUserCenters();
    if (window.location.pathname.includes('upload.html')) initFileUpload();
    if (window.location.pathname.includes('settings.html')) initSettingsPage();
    if (window.location.pathname.includes('confirmation.html')) loadConfirmationData();
});

document.getElementById('loginForm')?.addEventListener('submit', function(e) {
    e.preventDefault();
    const email = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;

    if (email === ADMIN_CREDENTIALS.email && password === ADMIN_CREDENTIALS.password) {
        localStorage.setItem('currentUser', JSON.stringify({ email, isAdmin: true }));
        window.location.href = 'admin.html';
    } else {
        fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        }).then(response => {
            if (response.ok) {
                localStorage.setItem('currentUser', JSON.stringify({ email }));
                window.location.href = 'home.html';
            } else alert('Invalid credentials');
        });
    }
});

document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ 
                email: document.getElementById('registerEmail').value, 
                password: document.getElementById('registerPassword').value 
            })
        });
        const data = await response.json();
        if (response.ok) {
            alert('Registration successful!');
            window.location.href = 'login.html';
        } else alert(data.message);
    } catch (error) {
        alert('An error occurred during registration');
    }
});

function renderCenters() {
    document.getElementById('centersContainer').innerHTML = centers.map(center => `
        <div class="dashboard-card p-6 hover-scale">
            <div class="flex justify-between items-start mb-4">
                <h3 class="text-xl font-semibold">${center.name}</h3>
                <button onclick="deleteCenter('${center.id}')" class="text-red-500 hover:text-red-600">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            <div class="text-gray-600">
                <p class="mb-2"><i class="fas fa-map-marker-alt mr-2"></i>${center.location}</p>
                <div class="flex items-center justify-between">
                    <span class="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                        ${center.distance} away
                    </span>
                    <div class="flex items-center">
                        <span class="text-yellow-500">
                            ${'★'.repeat(Math.floor(center.rating))}${center.rating % 1 ? '½' : ''}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

function renderUserCenters() {
    document.getElementById('userCentersContainer').innerHTML = centers.map(center => `
        <div class="dashboard-card p-6 hover-scale cursor-pointer" onclick="selectCenter('${center.id}')">
            <h3 class="text-xl font-semibold mb-2">${center.name}</h3>
            <div class="text-gray-600">
                <p class="mb-2"><i class="fas fa-map-marker-alt mr-2"></i>${center.location}</p>
                <div class="flex items-center justify-between">
                    <span class="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                        ${center.distance} away
                    </span>
                    <div class="flex items-center">
                        <span class="text-yellow-500">
                            ${'★'.repeat(Math.floor(center.rating))}${center.rating % 1 ? '½' : ''}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

function selectCenter(id) {
    currentPrintJob.center = id;
    localStorage.setItem('currentPrintJob', JSON.stringify(currentPrintJob));
    window.location.href = 'upload.html';
}

function initFileUpload() {
    const uploadZone = document.getElementById('uploadZone');
    const fileInput = document.getElementById('fileInput');

    uploadZone?.addEventListener('click', () => fileInput.click());
    
    fileInput?.addEventListener('change', function(e) {
        currentPrintJob.files = Array.from(e.target.files);
        localStorage.setItem('currentPrintJob', JSON.stringify(currentPrintJob));
        updateFileList();
    });

    uploadZone?.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('border-blue-400', 'bg-blue-50');
    });

    uploadZone?.addEventListener('dragleave', () => {
        uploadZone.classList.remove('border-blue-400', 'bg-blue-50');
    });

    uploadZone?.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('border-blue-400', 'bg-blue-50');
        currentPrintJob.files = Array.from(e.dataTransfer.files);
        localStorage.setItem('currentPrintJob', JSON.stringify(currentPrintJob));
        updateFileList();
    });
}

function updateFileList() {
    const fileList = document.getElementById('fileList');
    fileList.innerHTML = currentPrintJob.files.map(file => `
        <div class="dashboard-card p-4 flex items-center justify-between">
            <div>
                <p class="font-medium">${file.name}</p>
                <p class="text-sm text-gray-500">${(file.size/1024/1024).toFixed(2)} MB</p>
            </div>
            <button onclick="removeFile('${file.name}')" class="text-red-500 hover:text-red-600">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');
}

function removeFile(filename) {
    currentPrintJob.files = currentPrintJob.files.filter(file => file.name !== filename);
    localStorage.setItem('currentPrintJob', JSON.stringify(currentPrintJob));
    updateFileList();
}

function initSettingsPage() {
    document.querySelectorAll('input[name="color"]').forEach(input => {
        input.addEventListener('change', () => {
            currentPrintJob.settings.color = input.value;
            localStorage.setItem('currentPrintJob', JSON.stringify(currentPrintJob));
        });
    });

    document.getElementById('paperSize')?.addEventListener('change', (e) => {
        currentPrintJob.settings.size = e.target.value;
        localStorage.setItem('currentPrintJob', JSON.stringify(currentPrintJob));
    });

    document.getElementById('orientation')?.addEventListener('change', (e) => {
        currentPrintJob.settings.orientation = e.target.value;
        localStorage.setItem('currentPrintJob', JSON.stringify(currentPrintJob));
    });

    document.getElementById('copies')?.addEventListener('change', (e) => {
        currentPrintJob.settings.copies = parseInt(e.target.value);
        localStorage.setItem('currentPrintJob', JSON.stringify(currentPrintJob));
    });
}

function adjustCopies(change) {
    const copiesInput = document.getElementById('copies');
    let copies = parseInt(copiesInput.value) + change;
    copies = Math.max(1, copies);
    copiesInput.value = copies;
    currentPrintJob.settings.copies = copies;
    localStorage.setItem('currentPrintJob', JSON.stringify(currentPrintJob));
}

function loadConfirmationData() {
    currentPrintJob = JSON.parse(localStorage.getItem('currentPrintJob')) || {};
    showConfirmation();
}

function showConfirmation() {
    const { subtotal, total } = calculateTotalCost();
    
    document.getElementById('orderDetails').innerHTML = `
        <p><span class="font-medium">Color:</span> ${currentPrintJob.settings.color === 'bw' ? 'Black & White' : 'Color'}</p>
        <p><span class="font-medium">Paper Size:</span> ${currentPrintJob.settings.size}</p>
        <p><span class="font-medium">Copies:</span> ${currentPrintJob.settings.copies}</p>
        <p><span class="font-medium">Orientation:</span> ${currentPrintJob.settings.orientation}</p>
        <p><span class="font-medium">Files:</span> ${currentPrintJob.files.length}</p>
    `;

    document.getElementById('paymentSummary').innerHTML = `
        <div class="flex justify-between">
            <span>Subtotal:</span>
            <span>₹${subtotal.toFixed(2)}</span>
        </div>
        <div class="flex justify-between">
            <span>Service Fee:</span>
            <span>₹${PRICING.serviceFee.toFixed(2)}</span>
        </div>
        <div class="flex justify-between font-semibold border-t pt-3">
            <span>Total:</span>
            <span>₹${total.toFixed(2)}</span>
        </div>
    `;
}

function calculateTotalCost() {
    const colorRate = currentPrintJob.settings.color === 'bw' ? PRICING.bw : PRICING.color;
    const totalPages = currentPrintJob.files.length * currentPrintJob.settings.copies;
    const subtotal = totalPages * colorRate;
    const total = subtotal + PRICING.serviceFee;
    return { subtotal, total };
}

function submitPrintJob() {
    const { total } = calculateTotalCost();
    alert(`Print job submitted successfully!\nTotal: ₹${total.toFixed(2)}`);
    localStorage.removeItem('currentPrintJob');
    window.location.href = 'home.html';
}

function logout() {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('currentPrintJob');
    window.location.href = 'login.html';
}

document.getElementById('addCenterForm')?.addEventListener('submit', function(e) {
    e.preventDefault();
    centers.push({
        id: Date.now().toString(),
        name: document.getElementById('centerName').value,
        location: document.getElementById('centerLocation').value,
        rating: Math.floor(Math.random() * 3) + 3.5,
        distance: (Math.random() * 5).toFixed(1) + 'km'
    });
    localStorage.setItem('printingCenters', JSON.stringify(centers));
    renderCenters();
    hideAddCenterModal();
});

function showAddCenterModal() {
    document.getElementById('addCenterModal').classList.remove('hidden');
    document.getElementById('addCenterModal').classList.add('flex');
}

function hideAddCenterModal() {
    document.getElementById('addCenterModal').classList.add('hidden');
}

function deleteCenter(id) {
    centers = centers.filter(center => center.id !== id);
    localStorage.setItem('printingCenters', JSON.stringify(centers));
    renderCenters();
}

if (centers.length === 0) {
    centers = [
        { id: '1', name: 'AISSMS IOIT XEROX', location: 'Mangalwar Peth', rating: 4.5, distance: '0.5km' },
        { id: '2', name: 'COEP XEROX', location: 'COEP COLLEGE', rating: 4.8, distance: '1.2km' }
    ];
    localStorage.setItem('printingCenters', JSON.stringify(centers));
}