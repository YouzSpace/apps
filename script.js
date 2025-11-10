// 应用商店核心功能实现
class AppStore {
    constructor() {
        this.appsData = []; // 存储所有加载的应用数据
        this.filteredApps = []; // 存储过滤后的应用数据
        this.currentPage = 1; // 当前页码
        this.appsPerPage = 20; // 每页显示的应用数量，与API的默认值一致
        this.currentSort = 'popular';
        this.currentCategory = 'all';
        this.searchQuery = '';
        this.hasMorePages = true; // 标记是否还有更多页面
        this.totalCount = 0; // 总应用数量
        this.isLoading = false; // 标记是否正在加载数据

        this.init();
    }


    init() {
        // 检查关键DOM元素是否存在
        if (!this.checkRequiredElements()) {
            console.error('页面关键元素缺失，无法初始化应用商店');
            return;
        }

        this.bindEvents();
        this.loadAppsFromAPI();
        this.renderCategories();
    }

    // 检查必须的DOM元素是否存在
    checkRequiredElements() {
        const requiredElements = [
            'searchInput', 'searchBtn', 'loadMoreBtn',
            'categoryGrid', 'appsGrid'
        ];

        for (const elementId of requiredElements) {
            if (!document.getElementById(elementId)) {
                console.error(`找不到元素: ${elementId}`);
                return false;
            }
        }
        return true;
    }

    bindEvents() {
        // 搜索功能
        const searchInput = document.getElementById('searchInput');
        const searchBtn = document.getElementById('searchBtn');

        searchInput.addEventListener('input', (e) => {
            this.searchQuery = e.target.value;

            // 搜索防抖，避免频繁触发
            if (this.searchTimer) {
                clearTimeout(this.searchTimer);
            }

            this.searchTimer = setTimeout(() => {
                this.currentPage = 1;
                this.searchApps(this.searchQuery);

                // 如果搜索词为空，清空搜索提示
                if (!this.searchQuery.trim()) {
                    this.hideSearchSuggestions();
                }
            }, 500);
        });

        searchBtn.addEventListener('click', () => {
            this.searchQuery = searchInput.value;
            this.currentPage = 1;
            this.searchApps(this.searchQuery);
            this.hideSearchSuggestions();

            // 显示搜索提示
            if (this.searchQuery.trim()) {
                this.showSearchToast(this.searchQuery);
            }
        });



        // 加载更多
        const loadMoreBtn = document.getElementById('loadMoreBtn');
        loadMoreBtn.addEventListener('click', () => {
            this.loadMoreApps();
        });



        // 底部导航栏功能
        this.bindBottomNavEvents();
        
        // 桌面端导航栏功能
        this.bindDesktopNavEvents();
    }

    // 从API加载应用数据
    async loadAppsFromAPI(resetData = true) {
        try {
            // 如果正在加载，则不重复加载
            if (this.isLoading) return;

            this.isLoading = true;

            // 显示加载状态
            if (resetData) {
                this.showLoadingState();
            }

            // 构建API请求参数
            let apiUrl = `https://store.youz.space/api.php?user_id=youzapi&page=${this.currentPage}&limit=${this.appsPerPage}`;

            // 如果有搜索词，添加搜索参数
            if (this.searchQuery.trim()) {
                apiUrl += `&search=${encodeURIComponent(this.searchQuery.trim())}`;
            }

            // 注意：API不支持category参数，分类筛选需要在客户端进行

            console.log(`正在加载第 ${this.currentPage} 页数据: ${apiUrl}`);

            const response = await fetch(apiUrl);

            if (!response.ok) {
                throw new Error(`API请求失败: ${response.status}`);
            }

            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }

            // 获取分页信息
            if (data.pagination) {
                this.hasMorePages = data.pagination.has_next;
                this.totalCount = data.pagination.total_count;
                console.log(`API返回: 共 ${data.pagination.total_count} 个应用，当前页 ${data.pagination.current_page}/${data.pagination.total_pages}，还有更多页: ${this.hasMorePages}`);
            } else {
                // 如果API没有返回分页信息，假设没有更多数据
                this.hasMorePages = false;
            }

            // 转换API数据为应用格式
            const newApps = data.documents.map((doc, index) => {
                // 使用完整的应用名称
                const appName = doc.name;
                
                // 从名称中提取版本号（如果有）
                const versionMatch = appName.match(/(\d+\.\d+\.\d+)$/);
                const version = versionMatch ? versionMatch[1] : '1.0.0';

                // 根据应用名称和subtitle推断分类
                const category = this.inferCategory(appName, doc.subtitle);

                // 生成开发者名称
                const developer = this.inferDeveloper(appName);

                return {
                    id: parseInt(doc.id) || index + 1,
                    name: appName,
                    originalName: doc.name,
                    developer: developer,
                    description: doc.subtitle || `${appName} - 功能强大的应用程序`,
                    category: category,
                    rating: this.generateRandomRating(),
                    downloads: this.generateRandomDownloads(),
                    size: this.generateRandomSize(),
                    version: version,
                    updateDate: this.generateRandomDate(),
                    icon: doc.icon || 'https://via.placeholder.com/64x64/CCCCCC/FFFFFF?text=APP',
                    screenshots: this.generateScreenshots(appName),
                    downloadUrl: `https://store.youz.space/view.php?id=${doc.id}`
                };
            });

            // 如果是重置数据，清空现有数据
            if (resetData) {
                this.appsData = newApps;
                this.filteredApps = newApps;
            } else {
                // 否则追加到现有数据
                this.appsData = [...this.appsData, ...newApps];
                this.filteredApps = [...this.appsData];
            }

            // 应用分类筛选
            if (this.currentCategory !== 'all') {
                this.filterAppsByCategory();
            }

            // 渲染应用
            if (resetData) {
                this.renderApps();
            } else {
                this.renderMoreApps();
            }

            // 渲染分类
            if (resetData) {
                this.renderCategories();
            }

            this.hideLoadingState();
            this.isLoading = false;

        } catch (error) {
            console.error('加载应用数据失败:', error);
            this.isLoading = false;

            if (resetData) {
                this.showErrorState('加载应用数据失败，请检查网络连接');
                // 如果API调用失败，使用备用数据
                this.loadFallbackData();
            }
        }
    }


    // 显示加载状态
    showLoadingState() {
        const appsGrid = document.getElementById('appsGrid');
        appsGrid.innerHTML = `
            <div class="loading-container">
                <div class="loading-spinner"></div>
                <p>正在加载应用数据...</p>
            </div>
        `;
    }

    // 隐藏加载状态
    hideLoadingState() {
        // 清除加载状态，由renderApps处理
    }

    // 显示错误状态
    showErrorState(message) {
        const appsGrid = document.getElementById('appsGrid');
        appsGrid.innerHTML = `
            <div class="error-container">
                <div class="error-icon">⚠️</div>
                <h3>加载失败</h3>
                <p>${message}</p>
                <button class="retry-btn" onclick="appStore.loadAppsFromAPI()">重试</button>
            </div>
        `;
    }

    // 根据应用名称和subtitle推断分类
    inferCategory(appName, subtitle) {
        const combinedText = (appName + ' ' + (subtitle || '')).toLowerCase();
        
        // AE工程相关关键词
        const aeKeywords = ['ae', 'after effects', 'aftereffects', '特效', '模板', '工程', '脚本', '插件'];
        
        // 检查是否包含AE相关关键词
        for (const keyword of aeKeywords) {
            if (combinedText.includes(keyword)) {
                return 'AE工程';
            }
        }
        
        // 默认返回其他分类
        return '其他';
    }

    // 推断开发者
    inferDeveloper(appName) {
        const developerMap = {
            '微信': '腾讯科技',
            '支付宝': '蚂蚁集团',
            '抖音': '字节跳动',
            '淘宝': '阿里巴巴',
            '高德': '阿里巴巴',
            '网易云': '网易',
            '美团': '美团',
            '百度': '百度',
            'QQ': '腾讯科技',
            '京东': '京东',
            '滴滴': '滴滴出行',
            '快手': '快手科技'
        };

        for (const [key, value] of Object.entries(developerMap)) {
            if (appName.includes(key)) {
                return value;
            }
        }

        return '开发者团队';
    }

    // 生成随机评分
    generateRandomRating() {
        return parseFloat((4 + Math.random()).toFixed(1));
    }

    // 生成随机下载量
    generateRandomDownloads() {
        const downloads = [
            '100万+', '500万+', '1000万+', '5000万+',
            '1亿+', '5亿+', '10亿+'
        ];
        return downloads[Math.floor(Math.random() * downloads.length)];
    }

    // 生成随机大小
    generateRandomSize() {
        const sizes = ['50MB', '80MB', '120MB', '180MB', '250MB', '320MB'];
        return sizes[Math.floor(Math.random() * sizes.length)];
    }

    // 生成随机日期
    generateRandomDate() {
        const start = new Date(2023, 0, 1);
        const end = new Date();
        const date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
        return date.toISOString().split('T')[0];
    }

    // 生成应用截图
    generateScreenshots(appName) {
        const colors = ['#4CAF50', '#2196F3', '#FF5722', '#FF9800', '#009688', '#E91E63', '#9C27B0'];
        const color = colors[Math.floor(Math.random() * colors.length)];

        return [
            `https://via.placeholder.com/300x600/${color.substring(1)}/FFFFFF?text=${encodeURIComponent(appName + '界面1')}`,
            `https://via.placeholder.com/300x600/${color.substring(1)}/FFFFFF?text=${encodeURIComponent(appName + '界面2')}`,
            `https://via.placeholder.com/300x600/${color.substring(1)}/FFFFFF?text=${encodeURIComponent(appName + '界面3')}`
        ];
    }

    // 备用数据（API失败时使用）
    loadFallbackData() {
        const fallbackApps = [
            {
                id: 1,
                name: '测试APP',
                developer: '开发者团队',
                description: '这是一个测试应用，用于演示应用商店功能',
                category: '工具',
                rating: 4.5,
                downloads: '10万+',
                size: '50MB',
                version: '1.0.0',
                updateDate: '2024-01-01',
                icon: 'https://via.placeholder.com/64x64/CCCCCC/FFFFFF?text=APP',
                screenshots: this.generateScreenshots('测试APP'),
                downloadUrl: 'https://store.youz.space/view.php?id=79348'
            }
        ];

        this.appsData = fallbackApps;
        this.filteredApps = [...fallbackApps];
        this.renderApps();
    }

    // 渲染分类 - 显示全部和AE工程分类
    renderCategories() {
        // 统计AE工程分类的应用数量
        const aeCount = this.appsData.filter(app => app.category === 'AE工程').length;

        const categories = [
            { id: 'all', name: '全部', icon: '📱', count: this.appsData.length },
            { id: 'ae', name: 'AE工程', icon: '🎬', count: aeCount }
        ];

        const categoryGrid = document.getElementById('categoryGrid');
        categoryGrid.innerHTML = categories.map(category => `
            <a href="#" class="category-item ${category.id === 'all' ? 'active' : ''}" data-category="${category.id}">
                <div class="category-icon">${category.icon}</div>
                <div class="category-name">${category.name}</div>
            </a>
        `).join('');

        // 绑定分类点击事件
        categoryGrid.addEventListener('click', (e) => {
            e.preventDefault();
            if (e.target.closest('.category-item')) {
                const categoryId = e.target.closest('.category-item').dataset.category;
                this.currentCategory = categoryId;
                this.currentPage = 1;
                
                // 重置搜索状态
                this.searchQuery = '';
                const searchInput = document.getElementById('searchInput');
                if (searchInput) searchInput.value = '';
                
                // 重新加载数据
                this.loadAppsFromAPI(true);

                // 更新活跃状态
                document.querySelectorAll('.category-item').forEach(item => {
                    item.classList.remove('active');
                });
                e.target.closest('.category-item').classList.add('active');
            }
        });

        // 默认选中全部分类
        this.currentCategory = 'all';
    }

    // 搜索应用（重新从API加载数据）
    async searchApps(query) {
        this.searchQuery = query;
        this.currentPage = 1; // 重置页码
        await this.loadAppsFromAPI(true); // 重新加载数据
    }

    // 按分类筛选应用
    filterAppsByCategory() {
        if (this.currentCategory === 'all') {
            this.filteredApps = [...this.appsData];
        } else if (this.currentCategory === 'ae') {
            // 筛选AE工程分类的应用
            this.filteredApps = this.appsData.filter(app => app.category === 'AE工程');
        } else {
            this.filteredApps = [...this.appsData];
        }
        
        console.log(`AE工程分类筛选结果: ${this.filteredApps.length} 个应用，已加载AE应用总数: ${this.appsData.filter(app => app.category === 'AE工程').length}`);
        
        // 渲染应用
        this.renderApps();
        this.updateLoadMoreButton();
    }

    // 排序应用 - 按照API返回顺序
    sortApps() {
        // 保持API返回的原始顺序，不进行额外排序
        this.renderApps();
    }

    // 解析下载量
    parseDownloads(downloads) {
        if (downloads.includes('亿')) {
            return parseFloat(downloads) * 100000000;
        } else if (downloads.includes('万')) {
            return parseFloat(downloads) * 10000;
        }
        return parseFloat(downloads);
    }

    // 渲染应用列表 - 初始化渲染
    renderApps() {
        const appsGrid = document.getElementById('appsGrid');
        if (!appsGrid) {
            console.error('找不到应用网格容器');
            return;
        }

        // 直接显示当前页面的所有应用，不需要客户端分页计算
        const appsToShow = this.filteredApps;

        // 使用DocumentFragment提高性能，避免闪烁
        const fragment = document.createDocumentFragment();

        appsToShow.forEach(app => {
            const appCard = document.createElement('div');
            appCard.className = 'app-card';
            appCard.dataset.appId = app.id;
            appCard.innerHTML = `
    <div class="app-content">
        <img src="${app.icon}" alt="${app.name}" class="app-icon" onerror="this.src='https://via.placeholder.com/64x64/CCCCCC/FFFFFF?text=ICON'">
        <div class="app-info">
            <div class="app-name">${app.name}</div>
            <div class="app-description">${app.description}</div>
        </div>
    </div>
    <div class="app-footer">
        <button class="download-btn" data-app-id="${app.id}">下载</button>
    </div>
`;

            fragment.appendChild(appCard);
        });

        // 一次性插入所有卡片，避免多次重排
        appsGrid.innerHTML = '';
        appsGrid.appendChild(fragment);

        // 更新加载更多按钮状态
        this.updateLoadMoreButton();

        // 绑定应用点击事件
        this.bindAppEvents();
    }

    // 增量渲染更多应用 - 避免闪烁
    renderMoreApps() {
        const appsGrid = document.getElementById('appsGrid');
        if (!appsGrid) return;
        
        // 如果是AE工程分类，需要特殊处理
        if (this.currentCategory === 'ae') {
            // 只渲染新增的AE应用
            const currentDisplayedApps = Array.from(appsGrid.children).length;
            const newAEApps = this.appsData
                .filter(app => app.category === 'AE工程')
                .slice(currentDisplayedApps);
            
            if (newAEApps.length === 0) {
                this.updateLoadMoreButton();
                return;
            }
            
            // 使用DocumentFragment批量添加新卡片
            const fragment = document.createDocumentFragment();

            newAEApps.forEach(app => {
                const appCard = document.createElement('div');
                appCard.className = 'app-card';
                appCard.dataset.appId = app.id;
                appCard.innerHTML = `
    <div class="app-content">
        <img src="${app.icon}" alt="${app.name}" class="app-icon" onerror="this.src='https://via.placeholder.com/64x64/CCCCCC/FFFFFF?text=ICON'">
        <div class="app-info">
            <div class="app-name">${app.name}</div>
            <div class="app-description">${app.description}</div>
        </div>
    </div>
    <div class="app-footer">
        <button class="download-btn" data-app-id="${app.id}">下载</button>
    </div>
`;

                fragment.appendChild(appCard);
            });

            // 使用更平滑的添加方式
            appsGrid.appendChild(fragment);
        } else {
            // 全部分类的正常逻辑
            const startIndex = (this.currentPage - 1) * this.appsPerPage;
            const appsToAdd = this.filteredApps.slice(startIndex);
            
            if (appsToAdd.length === 0) {
                this.updateLoadMoreButton();
                return;
            }

            // 使用DocumentFragment批量添加新卡片
            const fragment = document.createDocumentFragment();

            appsToAdd.forEach(app => {
                const appCard = document.createElement('div');
                appCard.className = 'app-card';
                appCard.dataset.appId = app.id;
                appCard.innerHTML = `
    <div class="app-content">
        <img src="${app.icon}" alt="${app.name}" class="app-icon" onerror="this.src='https://via.placeholder.com/64x64/CCCCCC/FFFFFF?text=ICON'">
        <div class="app-info">
            <div class="app-name">${app.name}</div>
            <div class="app-description">${app.description}</div>
        </div>
    </div>
    <div class="app-footer">
        <button class="download-btn" data-app-id="${app.id}">下载</button>
    </div>
`;

                fragment.appendChild(appCard);
            });

            // 使用更平滑的添加方式
            appsGrid.appendChild(fragment);
        }

        // 绑定新添加的应用事件
        this.bindAppEvents();

        // 更新加载更多按钮状态
        this.updateLoadMoreButton();
    }

    // 更新加载更多按钮状态
    updateLoadMoreButton() {
        const loadMoreBtn = document.getElementById('loadMoreBtn');
        
        if (!loadMoreBtn) return;

        // 判断是否应该显示加载更多按钮
        let shouldShow = false;
        
        if (this.currentCategory === 'all') {
            // 全部分类：根据API分页信息
            shouldShow = this.hasMorePages;
        } else if (this.currentCategory === 'ae') {
            // AE工程分类：检查是否还有未加载的AE应用
            const loadedAECount = this.appsData.filter(app => app.category === 'AE工程').length;
            const displayedAECount = this.filteredApps.filter(app => app.category === 'AE工程').length;
            
            // 只有当已加载的AE应用数量大于已显示的数量时，才显示"加载更多"
            shouldShow = loadedAECount > displayedAECount && this.hasMorePages;
        }
        
        if (shouldShow) {
            // 显示按钮时使用淡入动画
            loadMoreBtn.style.display = 'block';
            loadMoreBtn.style.opacity = '0';
            setTimeout(() => {
                loadMoreBtn.style.opacity = '1';
            }, 10);
        } else {
            // 隐藏按钮时使用淡出动画
            loadMoreBtn.style.opacity = '0';
            setTimeout(() => {
                loadMoreBtn.style.display = 'none';
                loadMoreBtn.style.opacity = '1';
            }, 300);
        }
    }

    // 生成星级评分
    generateStars(rating) {
        const fullStars = Math.floor(rating);
        const halfStar = rating % 1 >= 0.5;
        const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);

        return '★'.repeat(fullStars) + (halfStar ? '☆' : '') + '☆'.repeat(emptyStars);
    }

    // 绑定应用事件
    bindAppEvents() {
        const appCards = document.querySelectorAll('.app-card');

        appCards.forEach(card => {
            card.addEventListener('click', (e) => {
                // 如果点击的是下载按钮，则不执行这里的代码
                if (e.target.classList.contains('download-btn')) {
                    return;
                }

                // 获取应用ID并直接调用下载功能
                const appId = parseInt(card.dataset.appId);
                this.downloadApp(appId);
            });
        });

        // 绑定下载按钮的点击事件
        const downloadButtons = document.querySelectorAll('.download-btn');
        downloadButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation(); // 阻止事件冒泡
                const appId = parseInt(button.dataset.appId);
                this.downloadApp(appId);
            });
        });

    }

    // 下载应用
    downloadApp(appId) {
        const app = this.appsData.find(a => a.id === appId);
        if (!app) return;

        // 使用实际的柚子云下载链接
        if (app.downloadUrl) {
            // 在新标签页打开下载页面
            window.open(app.downloadUrl, '_blank');

            // 显示下载提示
            this.showDownloadToast(app.name);
        } else {
            // 如果没有下载链接，显示提示
            alert(`准备下载 ${app.name}...\n\n下载链接正在生成中，请稍后重试。`);
        }

        console.log(`开始下载应用: ${app.name}, 下载链接: ${app.downloadUrl || '未设置'}`);
    }

    // 显示下载提示
    showDownloadToast(appName) {
        // 创建提示元素
        const toast = document.createElement('div');
        toast.className = 'download-toast';
        toast.innerHTML = `
            <div class="toast-content">
                <span class="toast-icon">⬇️</span>
                <span class="toast-text">正在准备下载 ${appName}</span>
            </div>
        `;

        // 添加样式
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--primary-color);
            color: white;
            padding: var(--spacing-md);
            border-radius: var(--radius-md);
            box-shadow: var(--shadow-lg);
            z-index: 1000;
            animation: slideIn 0.3s ease-out;
        `;

        document.body.appendChild(toast);

        // 3秒后自动消失
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
                if (toast.parentNode) {
                    document.body.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }

    // 加载更多应用 - 修复分页和分类问题
    async loadMoreApps() {
        // 如果没有更多页面或正在加载，则不执行
        if (!this.hasMorePages || this.isLoading) return;
        
        // 增加页码
        this.currentPage++;
        
        // 显示加载状态
        const loadMoreBtn = document.getElementById('loadMoreBtn');
        if (loadMoreBtn) {
            loadMoreBtn.classList.add('loading');
            loadMoreBtn.textContent = '加载中...';
        }
        
        // 记录当前AE应用数量，用于后续筛选
        const currentAECount = this.appsData.filter(app => app.category === 'AE工程').length;
        
        // 加载下一页数据 - 使用false表示不清空现有数据
        await this.loadAppsFromAPI(false);
        
        // 如果是AE工程分类，需要检查是否有新的AE应用
        if (this.currentCategory === 'ae') {
            const newAECount = this.appsData.filter(app => app.category === 'AE工程').length;
            
            if (newAECount > currentAECount) {
                // 有新AE应用，重新筛选显示
                this.filterAppsByCategory();
            } else {
                // 没有新AE应用，尝试加载下一页
                console.log('当前页面没有AE工程应用，将尝试加载下一页...');
                
                // 如果没有更多页面，确保按钮正确隐藏
                this.updateLoadMoreButton();
            }
        }
        
        // 恢复按钮状态
        if (loadMoreBtn) {
            loadMoreBtn.classList.remove('loading');
            loadMoreBtn.textContent = '加载更多';
        }
    }

    // 绑定底部导航栏事件
    bindBottomNavEvents() {
        const footerNavItems = document.querySelectorAll('.footer-nav-item');

        footerNavItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();

                // 移除所有活跃状态
                footerNavItems.forEach(navItem => {
                    navItem.classList.remove('active');
                });

                // 添加当前活跃状态
                item.classList.add('active');

                // 根据点击的导航项执行相应操作
                const navText = item.querySelector('span').textContent;
                this.handleBottomNavClick(navText);
            });
        });
    }

    // 处理底部导航点击
    handleBottomNavClick(navText) {
        switch (navText) {
            case '首页':
                // 滚动到顶部
                window.scrollTo({ top: 0, behavior: 'smooth' });
                break;
            case '免责声明':
                // 跳转到免责声明页面
                this.showDisclaimer();
                break;

            case 'Github':
                // 显示个人信息（暂时用提示替代）
                window.location.href = 'https://github.com/YouzSpace/apps';
                break;
        }
    }

    // 绑定桌面端导航栏事件
    bindDesktopNavEvents() {
        const desktopNavLinks = document.querySelectorAll('.desktop-nav .nav-link');

        desktopNavLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();

                // 移除所有活跃状态
                desktopNavLinks.forEach(navLink => {
                    navLink.classList.remove('active');
                });

                // 添加当前活跃状态
                link.classList.add('active');

                // 根据点击的导航项执行相应操作
                const navText = link.textContent;
                this.handleDesktopNavClick(navText);
            });
        });
    }

    // 处理桌面端导航点击
    handleDesktopNavClick(navText) {
        switch (navText) {
            case '首页':
                // 滚动到顶部
                window.scrollTo({ top: 0, behavior: 'smooth' });
                break;
            case '免责声明':
                // 显示免责声明页面
                this.showDisclaimer();
                break;
            case 'Github':
                // 跳转到Github页面
                window.open('https://github.com/YouzSpace/apps', '_blank');
                break;
        }
    }

    // 显示免责声明页面
    showDisclaimer() {
        // 创建免责声明模态框
        const disclaimerModal = document.createElement('div');
        disclaimerModal.className = 'disclaimer-modal';
        disclaimerModal.innerHTML = `
            <div class="disclaimer-content">
                <div class="disclaimer-header">
                    <h3>免责声明</h3>
                    <button class="close-btn">&times;</button>
                </div>
                <div class="disclaimer-body">
                    <p><strong>1.</strong> 本站提供的所有软件及相关资源，仅可供用户用于学习和交流，请用户在使用过程中严格遵循国家相关法律法规及行业规范，不得用于任何违法违规用途。</p>
                    
                    <p><strong>2.</strong> 本站所分享的资源内容均为网络收集整理所得，不代表本站立场。若资源存在侵权、违规、内容不妥等情况，版权方或相关方请及时联系本站，本站在收到通知后将第一时间进行核查并删除相关内容，由此带来的不便敬请谅解。</p>
                    
                    <p><strong>3.</strong> 本站发布的破解补丁、注册机、注册信息及软件解密分析文章等内容，仅限用于学习和研究目的。用户不得将上述内容用于商业活动或者非法用途，否则，一切后果由用户自负，与本站无关。</p>
                    
                    <p><strong>4.</strong> 您必须在下载本站资源后的24个小时之内，从您的电脑及相关存储设备中彻底删除上述内容。若您对相关程序或软件感兴趣，建议支持正版软件，通过正规渠道购买注册，以获得更完善的正版服务与保障。</p>
                    
                    <p><strong>5.</strong> 本站信息来源于网络，所有资源的版权归属原作者或相关权利人。若因资源引发版权争议，相关责任与本站无关。如涉及侵权问题，请版权方通过邮箱 <a href="mailto:youz.space@foxmail.com">youz.space@foxmail.com</a> 与我们联系处理，我们将积极配合。</p>
                    
                    <p class="disclaimer-note">请您在使用本站资源前仔细阅读本声明，一旦您下载或使用本站资源，即视为您已同意并接受本声明的全部内容。</p>
                </div>
            </div>
        `;

        // 添加样式
        disclaimerModal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            animation: fadeIn 0.3s ease-out;
        `;

        const disclaimerContent = disclaimerModal.querySelector('.disclaimer-content');
        disclaimerContent.style.cssText = `
            background: white;
            border-radius: 12px;
            padding: 0;
            max-width: 90%;
            max-height: 90%;
            width: 600px;
            overflow: hidden;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        `;

        const disclaimerHeader = disclaimerModal.querySelector('.disclaimer-header');
        disclaimerHeader.style.cssText = `
            background: var(--primary-color);
            color: white;
            padding: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid var(--border-color);
        `;

        disclaimerHeader.querySelector('h3').style.cssText = `
            margin: 0;
            font-size: 18px;
            font-weight: 600;
        `;

        const closeBtn = disclaimerModal.querySelector('.close-btn');
        closeBtn.style.cssText = `
            background: none;
            border: none;
            color: white;
            font-size: 24px;
            cursor: pointer;
            padding: 0;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            transition: background-color 0.2s;
        `;

        closeBtn.addEventListener('mouseenter', () => {
            closeBtn.style.background = 'rgba(255, 255, 255, 0.2)';
        });

        closeBtn.addEventListener('mouseleave', () => {
            closeBtn.style.background = 'none';
        });

        const disclaimerBody = disclaimerModal.querySelector('.disclaimer-body');
        disclaimerBody.style.cssText = `
            padding: 20px;
            max-height: 400px;
            overflow-y: auto;
            font-size: 14px;
            line-height: 1.6;
        `;

        disclaimerBody.querySelectorAll('p').forEach(p => {
            p.style.marginBottom = '15px';
        });

        const disclaimerNote = disclaimerModal.querySelector('.disclaimer-note');
        disclaimerNote.style.cssText = `
            background: #fff9e6;
            padding: 15px;
            border-radius: 6px;
            border-left: 4px solid #ffc107;
            font-weight: 500;
            margin-top: 20px;
        `;

        // 关闭按钮事件
        closeBtn.addEventListener('click', () => {
            disclaimerModal.style.animation = 'fadeOut 0.3s ease-in';
            setTimeout(() => {
                if (disclaimerModal.parentNode) {
                    document.body.removeChild(disclaimerModal);
                }
            }, 300);
        });

        // 点击模态框背景关闭
        disclaimerModal.addEventListener('click', (e) => {
            if (e.target === disclaimerModal) {
                closeBtn.click();
            }
        });

        // 添加键盘事件
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                closeBtn.click();
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        // 清理事件监听器
        const cleanup = () => {
            document.removeEventListener('keydown', handleKeyDown);
        };

        disclaimerModal.addEventListener('animationend', (e) => {
            if (e.animationName === 'fadeOut') {
                cleanup();
            }
        });

        // 添加到页面
        document.body.appendChild(disclaimerModal);
        
        // 滚动到顶部
        disclaimerBody.scrollTop = 0;
    }

    // 显示搜索提示
    showSearchToast(searchQuery) {
        const toast = document.createElement('div');
        toast.className = 'search-toast';
        toast.innerHTML = `
            <div class="toast-content">
                <span class="toast-icon">🔍</span>
                <span class="toast-text">搜索: "${searchQuery}"</span>
            </div>
        `;

        toast.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: var(--primary-color);
            color: white;
            padding: var(--spacing-md);
            border-radius: var(--radius-md);
            box-shadow: var(--shadow-lg);
            z-index: 1000;
            animation: fadeInUp 0.3s ease-out;
        `;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'fadeOutDown 0.3s ease-in';
            setTimeout(() => {
                if (toast.parentNode) {
                    document.body.removeChild(toast);
                }
            }, 300);
        }, 2000);
    }

}

// 全局应用商店实例
let appStore;

// 页面加载完成后初始化应用商店
document.addEventListener('DOMContentLoaded', () => {
    appStore = new AppStore();
});