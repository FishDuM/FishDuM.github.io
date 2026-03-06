// 滚动动画控制
document.addEventListener('DOMContentLoaded', function() {
    // 主题切换功能
    const themeToggle = document.getElementById('theme-toggle');
    const body = document.body;
    const themeIcon = themeToggle.querySelector('i');
    
    // 检查本地存储中的主题偏好
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        body.classList.add('light-theme');
        themeIcon.classList.remove('fa-moon');
        themeIcon.classList.add('fa-sun');
    }
    
    // 主题切换事件
    themeToggle.addEventListener('click', function() {
        body.classList.toggle('light-theme');
        
        if (body.classList.contains('light-theme')) {
            themeIcon.classList.remove('fa-moon');
            themeIcon.classList.add('fa-sun');
            localStorage.setItem('theme', 'light');
        } else {
            themeIcon.classList.remove('fa-sun');
            themeIcon.classList.add('fa-moon');
            localStorage.setItem('theme', 'dark');
        }
    });
    
    // 语言切换功能
    const languageToggle = document.getElementById('language-toggle');
    const languageContainer = document.querySelector('.language-container');
    const languageOptions = document.querySelectorAll('.language-option');
    let currentLang = 'zh-cn'; // 默认语言
    
    // 多语言内容
    const translations = {
        'zh-cn': {
            title: '会飞的鱼 - Java后端开发者',
            name: '会飞的鱼',
            role: 'Java后端开发者',
            intro1: '我是会飞的鱼，一名Java后端开发者，热爱编写高质量、可维护的代码。',
            intro2: '拥有丰富的后端开发经验，熟悉Spring Boot、Spring Cloud等主流框架，致力于构建可靠、高效的企业级应用。',
            skills: '我的技术栈',
            projects: '我的项目',
            project1: 'PopWord弹词',
            project1Desc: '基于 Chrome 扩展的英语学习插件。支持四级、六级等英语词汇。在网页上通过左/右键点击切换单词，支持发音、浮动展示、多词库、学习记录与缓存管理，助你边浏览边记单词。',
            project2: '智能云图库',
            project2Desc: '开发中。',
            project3: '高并发秒杀商城',
            project3Desc: '开发中。',
            contact: '联系方式',
            email: '邮箱: fish.java.react@gmail.com',
            github: 'GitHub: https://github.com/FishDuM',
            qq: 'QQ：3057433102',
            friendLink: '友链：',
            friendName: '大星科技',
            footer: '© 2026 会飞的鱼. All rights reserved.',
            danmaku: [
                '帅气的后端开发者',
                '全栈开发者',
                '跑马拉松的开发者',
                '技术大牛',
                '代码艺术家',
                '编程高手',
                '架构师',
                '解决方案专家',
                '性能优化大师',
                '安全专家',
                '数据库专家',
                '微服务架构师',
                'DevOps工程师',
                '敏捷开发实践者',
                '持续集成专家'
            ]
        },
        'zh': {
            title: '會飛的魚 - Java後端開發者',
            name: '會飛的魚',
            role: 'Java後端開發者',
            intro1: '我係會飛的魚，一名Java後端開發者，鍾意寫高質素、可維護嘅代碼。',
            intro2: '有豐富嘅後端開發經驗，熟識Spring Boot、Spring Cloud等主流框架，致力於構建可靠、高效嘅企業級應用。',
            skills: '我嘅技術棧',
            projects: '我嘅項目',
            project1: 'PopWord彈詞',
            project1Desc: '基於 Chrome 擴展嘅英語學習插件。支援四級、六級等英語詞彙。喺網頁上通過左/右鍵點擊切換單詞，支援發音、浮動展示、多詞庫、學習記錄與緩存管理，幫你邊瀏覽邊記單詞。',
            project2: '智能雲圖庫',
            project2Desc: '開發中。',
            project3: '高併發秒殺商城',
            project3Desc: '開發中。',
            contact: '聯絡方式',
            email: '電郵: fish.java.react@gmail.com',
            github: 'GitHub: https://github.com/FishDuM',
            qq: 'QQ：3057433102',
            friendLink: '友鏈：',
            friendName: '大星科技',
            footer: '© 2026 會飛的魚. All rights reserved.',
            danmaku: [
                '靚仔嘅後端開發者',
                '全棧開發者',
                '跑馬拉松嘅開發者',
                '技術大牛',
                '代碼藝術家',
                '編程高手',
                '架構師',
                '解決方案專家',
                '性能優化大師',
                '安全專家',
                '數據庫專家',
                '微服務架構師',
                'DevOps工程師',
                '敏捷開發實踐者',
                '持續集成專家'
            ]
        },
        'en': {
            title: 'Flying Fish - Java Backend Developer',
            name: 'Flying Fish',
            role: 'Java Backend Developer',
            intro1: 'I am Flying Fish, a Java backend developer who loves writing high-quality, maintainable code.',
            intro2: 'With rich backend development experience, familiar with mainstream frameworks such as Spring Boot and Spring Cloud, dedicated to building reliable and efficient enterprise applications.',
            skills: 'My Tech Stack',
            projects: 'My Projects',
            project1: 'PopWord',
            project1Desc: 'An English learning plugin based on Chrome extension. Supports CET-4, CET-6 and other English vocabulary. Switch words by left/right clicking on the webpage, supports pronunciation, floating display, multiple word libraries, learning records and cache management, helping you memorize words while browsing.',
            project2: 'Intelligent Cloud Gallery',
            project2Desc: 'Under development.',
            project3: 'High Concurrency Flash Sale Mall',
            project3Desc: 'Under development.',
            contact: 'Contact',
            email: 'Email: fish.java.react@gmail.com',
            github: 'GitHub: https://github.com/FishDuM',
            qq: 'QQ: 3057433102',
            friendLink: 'Friend Link: ',
            friendName: 'Daxing Technology',
            footer: '© 2026 Flying Fish. All rights reserved.',
            danmaku: [
                'Handsome backend developer',
                'Full stack developer',
                'Marathon running developer',
                'Tech expert',
                'Code artist',
                'Programming master',
                'Architect',
                'Solution expert',
                'Performance optimization master',
                'Security expert',
                'Database expert',
                'Microservice architect',
                'DevOps engineer',
                'Agile development practitioner',
                'Continuous integration expert'
            ]
        },
        'ja': {
            title: '飛ぶ魚 - Javaバックエンド開発者',
            name: '飛ぶ魚',
            role: 'Javaバックエンド開発者',
            intro1: '私は飛ぶ魚で、Javaバックエンド開発者です。高品質で保守可能なコードを書くのが大好きです。',
            intro2: '豊富なバックエンド開発経験を持ち、Spring Boot、Spring Cloudなどの主流フレームワークに精通し、信頼性が高く効率的なエンタープライズアプリケーションの構築に取り組んでいます。',
            skills: '私の技術スタック',
            projects: '私のプロジェクト',
            project1: 'PopWord',
            project1Desc: 'Chrome拡張機能ベースの英語学習プラグイン。大学英語4級、6級などの英語語彙に対応。ウェブページで左右クリックで単語を切り替え、発音、フローティング表示、複数の語彙集、学習記録とキャッシュ管理をサポートし、閲覧しながら単語を覚えるのを助けます。',
            project2: 'インテリジェントクラウドギャラリー',
            project2Desc: '開発中。',
            project3: '高并发秒杀商城',
            project3Desc: '開発中。',
            contact: 'お問い合わせ',
            email: 'メール: fish.java.react@gmail.com',
            github: 'GitHub: https://github.com/FishDuM',
            qq: 'QQ: 3057433102',
            friendLink: '友達リンク: ',
            friendName: '大星科技',
            footer: '© 2026 飛ぶ魚. All rights reserved.',
            danmaku: [
                'ハンサムなバックエンド開発者',
                'フルスタック開発者',
                'マラソンランニング開発者',
                '技術の達人',
                'コードアーティスト',
                'プログラミングマスター',
                'アーキテクト',
                'ソリューションエキスパート',
                'パフォーマンス最適化マスター',
                'セキュリティエキスパート',
                'データベースエキスパート',
                'マイクロサービスアーキテクト',
                'DevOpsエンジニア',
                'アジャイル開発実践者',
                '継続的インテグレーションエキスパート'
            ]
        }
    };
    
    // 点击语言按钮切换选项列表显示
    languageToggle.addEventListener('click', function(e) {
        e.stopPropagation();
        languageContainer.classList.toggle('active');
    });
    
    // 点击语言选项
    languageOptions.forEach(option => {
        option.addEventListener('click', function(e) {
            e.stopPropagation();
            const lang = this.getAttribute('data-lang');
            console.log('Selected language:', lang);
            
            // 切换语言
            changeLanguage(lang);
            
            languageContainer.classList.remove('active');
        });
    });
    
    // 切换语言函数
    function changeLanguage(lang) {
        const translation = translations[lang];
        if (!translation) return;
        
        // 更新当前语言
        currentLang = lang;
        
        // 更新页面内容（除了 h1，因为它需要特殊处理）
        document.title = translation.title;
        document.querySelector('header p').textContent = translation.role;
        document.querySelector('.left-bubble p').textContent = translation.intro1;
        document.querySelector('.right-bubble p').textContent = translation.intro2;
        document.querySelector('#skills h2').textContent = translation.skills;
        document.querySelector('#projects h2').textContent = translation.projects;
        document.querySelector('#contact h2').textContent = translation.contact;
        
        // 更新项目内容
        const projectItems = document.querySelectorAll('.project-item');
        projectItems[0].querySelector('h3').textContent = translation.project1;
        projectItems[0].querySelector('p').textContent = translation.project1Desc;
        projectItems[1].querySelector('h3').textContent = translation.project2;
        projectItems[1].querySelector('p').textContent = translation.project2Desc;
        projectItems[2].querySelector('h3').textContent = translation.project3;
        projectItems[2].querySelector('p').textContent = translation.project3Desc;
        
        // 更新联系方式
        const contactItems = document.querySelectorAll('#contact p');
        contactItems[0].textContent = translation.email;
        contactItems[1].textContent = translation.github;
        contactItems[2].textContent = translation.qq;
        
        // 更新友联
        const friendLink = document.querySelector('.friend-link');
        friendLink.innerHTML = `${translation.friendLink}<i class="fas fa-link"></i> ${translation.friendName}`;
        
        // 更新页脚
        document.querySelector('footer p').textContent = translation.footer;
        
        // 更新弹幕内容
        updateDanmaku(translation.danmaku);
        
        // 直接调用 typeWriter 函数，让它处理 h1 的更新
        typeWriter(translation.name);
    }
    
    // 更新弹幕内容
    function updateDanmaku(danmakuTexts) {
        const danmakuTrack = document.getElementById('danmakuTrack');
        
        // 清空现有弹幕
        danmakuTrack.innerHTML = '';
        
        // 根据屏幕尺寸计算弹幕数量
        function getDanmakuCount() {
            const screenHeight = window.innerHeight;
            const lineHeight = 40; // 每条弹幕的高度
            return Math.floor(screenHeight / lineHeight);
        }
        
        const danmakuCount = getDanmakuCount();
        
        // 创建新弹幕
        for (let i = 0; i < danmakuCount; i++) {
            const danmaku = document.createElement('div');
            danmaku.className = 'danmaku-item';
            danmaku.textContent = danmakuTexts[Math.floor(Math.random() * danmakuTexts.length)];
            
            // 随机垂直位置
            const top = i * 40 + 20;
            danmaku.style.top = `${top}px`;
            
            // 随机动画持续时间（8-12秒）
            const duration = 8 + Math.random() * 4;
            danmaku.style.animationDuration = `${duration}s`;
            
            // 随机延迟，避免同时出现
            const delay = Math.random() * 5;
            danmaku.style.animationDelay = `${delay}s`;
            
            danmakuTrack.appendChild(danmaku);
        }
    }
    

    
    // 上排滚动逻辑
    const scrollLeft = document.getElementById('scrollLeft');
    const row1 = document.getElementById('row1');
    let leftPosition = 0;
    const leftSpeed = 2;
    let leftAnimationId;
    
    // 下排滚动逻辑
    const scrollRight = document.getElementById('scrollRight');
    const row2 = document.getElementById('row2');
    let rightPosition = 0;
    const rightSpeed = 2;
    let rightAnimationId;
    
    // 等待内容渲染完成后获取宽度
    setTimeout(() => {
        // 上排内容宽度
        const leftContentWidth = scrollLeft.scrollWidth / 2;
        
        // 上排滚动函数（从右往左）
        function scrollLeftAnimation() {
            leftPosition -= leftSpeed;
            if (leftPosition < -leftContentWidth) {
                leftPosition = 0;
            }
            scrollLeft.style.transform = `translateX(${leftPosition}px)`;
            leftAnimationId = requestAnimationFrame(scrollLeftAnimation);
        }
        
        // 下排内容宽度
        const rightContentWidth = scrollRight.scrollWidth / 2;
        // 初始化下排初始位置
        rightPosition = -rightContentWidth;
        
        // 下排滚动函数（从左往右）
        function scrollRightAnimation() {
            rightPosition += rightSpeed;
            if (rightPosition > 0) {
                rightPosition = -rightContentWidth;
            }
            scrollRight.style.transform = `translateX(${rightPosition}px)`;
            rightAnimationId = requestAnimationFrame(scrollRightAnimation);
        }
        
        // 开始滚动
        scrollLeftAnimation();
        scrollRightAnimation();
        
        // 鼠标悬停停止上排滚动
        row1.addEventListener('mouseenter', function() {
            cancelAnimationFrame(leftAnimationId);
        });
        
        // 鼠标离开继续上排滚动
        row1.addEventListener('mouseleave', function() {
            scrollLeftAnimation();
        });
        
        // 鼠标悬停停止下排滚动
        row2.addEventListener('mouseenter', function() {
            cancelAnimationFrame(rightAnimationId);
        });
        
        // 鼠标离开继续下排滚动
        row2.addEventListener('mouseleave', function() {
            scrollRightAnimation();
        });
    }, 100);
    
    // 滚动时的动画效果
    let headerVisible = true;
    window.addEventListener('scroll', function() {
        const scrollTop = window.pageYOffset;
        const header = document.querySelector('header');
        const headerContainer = document.querySelector('.header-container');
        const leftBubble = document.querySelector('.left-bubble');
        const rightBubble = document.querySelector('.right-bubble');
        const screenHeight = window.innerHeight;
        
        // 计算透明度，当滚动到200px时完全透明
        const opacity = Math.max(0, 1 - scrollTop / 200);
        headerContainer.style.opacity = opacity;
        
        // 计算气泡的滑动距离和透明度
        const bubbleScrollThreshold = screenHeight * 0.5; // 开始滑动的阈值
        const bubbleSlideDistance = screenHeight * 1.5; // 150%的屏幕高度作为滑动距离
        
        if (scrollTop > 50) {
            // 显示气泡
            leftBubble.style.opacity = '1';
            rightBubble.style.opacity = '1';
        } else {
            // 隐藏气泡
            leftBubble.style.opacity = '0';
            leftBubble.style.transform = 'translateY(20px)';
            rightBubble.style.opacity = '0';
            rightBubble.style.transform = 'translateY(20px)';
        }
        
        // 当滚动超过阈值时，开始滑动气泡
        if (scrollTop > bubbleScrollThreshold) {
            // 计算滑动进度（0-1）
            const slideProgress = Math.min(1, (scrollTop - bubbleScrollThreshold) / bubbleSlideDistance);
            // 计算滑动距离
            const slideDistance = slideProgress * screenHeight * 1.5;
            // 计算透明度（随滑动逐渐消失）
            const bubbleOpacity = Math.max(0, 1 - slideProgress);
            
            // 应用样式
            leftBubble.style.transform = `translateY(${slideDistance}px)`;
            leftBubble.style.opacity = bubbleOpacity;
            rightBubble.style.transform = `translateY(${slideDistance}px)`;
            rightBubble.style.opacity = bubbleOpacity;
        }
        
        // 当滚动超过200px时，隐藏header
        if (scrollTop > 200) {
            if (headerVisible) {
                header.style.opacity = '0';
                headerVisible = false;
            }
        } else {
            if (!headerVisible) {
                header.style.opacity = '1';
                headerVisible = true;
                // 重新初始化弹幕，确保使用当前选择的语言
                initDanmaku();
            }
        }
    });
    
    // 弹幕功能
    function initDanmaku() {
        const danmakuTrack = document.getElementById('danmakuTrack');
        
        // 根据屏幕尺寸计算弹幕数量
        function getDanmakuCount() {
            const screenHeight = window.innerHeight;
            const lineHeight = 40; // 每条弹幕的高度
            return Math.floor(screenHeight / lineHeight);
        }
        
        // 创建弹幕
        function createDanmaku(danmakuTexts = translations[currentLang].danmaku) {
            const danmakuCount = getDanmakuCount();
            
            // 清空现有弹幕
            danmakuTrack.innerHTML = '';
            
            // 创建弹幕
            for (let i = 0; i < danmakuCount; i++) {
                const danmaku = document.createElement('div');
                danmaku.className = 'danmaku-item';
                danmaku.textContent = danmakuTexts[Math.floor(Math.random() * danmakuTexts.length)];
                
                // 随机垂直位置
                const top = i * 40 + 20;
                danmaku.style.top = `${top}px`;
                
                // 随机动画持续时间（8-12秒）
                const duration = 8 + Math.random() * 4;
                danmaku.style.animationDuration = `${duration}s`;
                
                // 随机延迟，避免同时出现
                const delay = Math.random() * 5;
                danmaku.style.animationDelay = `${delay}s`;
                
                danmakuTrack.appendChild(danmaku);
            }
        }
        
        // 初始化弹幕
        createDanmaku();
        
        // 窗口大小改变时重新计算弹幕数量
        window.addEventListener('resize', function() {
            createDanmaku();
        });
    }
    
    // 初始化弹幕
    initDanmaku();
    
    // 打字机效果
    let typingTimeout;
    let erasingTimeout;
    let currentText = '';
    
    function typeWriter(newText = null) {
        // 清除之前的定时器，避免多个实例同时运行
        if (typingTimeout) clearTimeout(typingTimeout);
        if (erasingTimeout) clearTimeout(erasingTimeout);
        
        const h1 = document.querySelector('header h1');
        
        // 如果提供了新文本，使用它；否则使用当前 h1 的内容
        if (newText) {
            currentText = newText;
        } else {
            currentText = h1.textContent;
        }
        
        let index = 0;
        
        // 初始清空内容
        h1.textContent = '';
        
        function type() {
            if (index < currentText.length) {
                h1.textContent += currentText.charAt(index);
                index++;
                typingTimeout = setTimeout(type, 250); // 打字速度
            } else {
                // 打字完成，等待3秒后开始删除
                typingTimeout = setTimeout(erase, 3000);
            }
        }
        
        function erase() {
            if (h1.textContent.length > 0) {
                h1.textContent = h1.textContent.slice(0, -1);
                erasingTimeout = setTimeout(erase, 150); // 删除速度
            } else {
                // 删除完成，等待1秒后重新开始打字
                erasingTimeout = setTimeout(() => {
                    // 直接使用当前保存的文本重新开始，而不是获取 h1 的内容
                    // 因为 h1 此时是空的
                    typeWriter(currentText);
                }, 1000);
            }
        }
        
        type();
    }
    
    // 初始化打字机效果
    typeWriter();
});