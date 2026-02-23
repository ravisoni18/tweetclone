import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Menu, X } from 'lucide-react';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import Feed from './components/Feed';
import RightSidebar from './components/RightSidebar';
import Profile from './components/Profile';
import PostDetail from './components/PostDetail';
import ComposePost from './components/ComposePost';
import ArticleViewer from './components/ArticleViewer';
import { ThemeProvider } from './contexts/ThemeContext';

import './App.css';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('home');
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [authInitialized, setAuthInitialized] = useState(false);
  
  // Profile navigation state
  const [showProfile, setShowProfile] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Post detail navigation state
  const [showPostDetail, setShowPostDetail] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  // ADDED: Article navigation state
  const [showArticle, setShowArticle] = useState(false);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);

  // Check if device is mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Wait for auth to initialize before making decisions
  useEffect(() => {
    if (!loading) {
      setAuthInitialized(true);
    }
  }, [loading]);

  // Handle browser navigation (back/forward buttons)
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state;
      if (state && state.type === 'profile' && state.userId) {
        setSelectedUserId(state.userId);
        setShowProfile(true);
        setShowPostDetail(false);
        setSelectedPostId(null);
        setShowArticle(false);
        setSelectedArticleId(null);
        setActiveTab('profile');
      } else if (state && state.type === 'post' && state.postId) {
        setSelectedPostId(state.postId);
        setShowPostDetail(true);
        setShowProfile(false);
        setSelectedUserId(null);
        setShowArticle(false);
        setSelectedArticleId(null);
        setActiveTab('post');
      } else if (state && state.type === 'article' && state.articleId) {
        setSelectedArticleId(state.articleId);
        setShowArticle(true);
        setShowProfile(false);
        setSelectedUserId(null);
        setShowPostDetail(false);
        setSelectedPostId(null);
        setActiveTab('article');
      } else {
        setShowProfile(false);
        setSelectedUserId(null);
        setShowPostDetail(false);
        setSelectedPostId(null);
        setShowArticle(false);
        setSelectedArticleId(null);
        setActiveTab('home');
      }
    };

    window.addEventListener('popstate', handlePopState);
    
    // Check initial URL for profile, post, or article route - but only after auth is ready
    if (authInitialized) {
      const path = window.location.pathname;
      const profileMatch = path.match(/^\/patr\/profile\/(.+)$/);
      const postMatch = path.match(/^\/patr\/post\/(.+)$/);
      const articleMatch = path.match(/^\/patr\/article\/(.+)$/);
      
      if (profileMatch) {
        const userId = profileMatch[1];
        setSelectedUserId(userId);
        setShowProfile(true);
        setActiveTab('profile');
      } else if (postMatch) {
        const postId = postMatch[1];
        setSelectedPostId(postId);
        setShowPostDetail(true);
        setActiveTab('post');
      } else if (articleMatch) {
        const articleId = articleMatch[1];
        setSelectedArticleId(articleId);
        setShowArticle(true);
        setActiveTab('article');
      }
    }

    return () => window.removeEventListener('popstate', handlePopState);
  }, [authInitialized]);

  // Update URL when navigating to profile, post, or article
  const updateURL = (userId?: string, postId?: string, articleId?: string) => {
    let newURL = '/patr/';
    let state: any = { type: 'home' };
    
    if (userId) {
      newURL = `/patr/profile/${userId}`;
      state = { type: 'profile', userId };
    } else if (postId) {
      newURL = `/patr/post/${postId}`;
      state = { type: 'post', postId };
    } else if (articleId) {
      newURL = `/patr/article/${articleId}`;
      state = { type: 'article', articleId };
    }
    
    if (window.location.pathname !== newURL) {
      window.history.pushState(state, '', newURL);
    }
  };

  // Close mobile menu when tab changes
  const handleTabChange = (tab: string) => {
    if (tab === 'compose') {
      setShowComposeModal(true);
    } else if (tab === 'profile') {
      // Show current user's profile
      const userId = user?.id;
      setSelectedUserId(userId || null);
      setShowProfile(true);
      setShowPostDetail(false);
      setSelectedPostId(null);
      setShowArticle(false);
      setSelectedArticleId(null);
      setActiveTab(tab);
      updateURL(userId);
    } else {
      setActiveTab(tab);
      setShowComposeModal(false);
      setShowProfile(false);
      setSelectedUserId(null);
      setShowPostDetail(false);
      setSelectedPostId(null);
      setShowArticle(false);
      setSelectedArticleId(null);
      updateURL();
    }
    setShowMobileMenu(false);
  };

  // Handle user profile navigation from search/posts
  const handleUserClick = (userId: string) => {
    setSelectedUserId(userId);
    setShowProfile(true);
    setShowPostDetail(false);
    setSelectedPostId(null);
    setShowArticle(false);
    setSelectedArticleId(null);
    setActiveTab('profile');
    setShowMobileMenu(false);
    updateURL(userId);
  };

  // Handle post detail navigation
  const handlePostClick = (postId: string) => {
    setSelectedPostId(postId);
    setShowPostDetail(true);
    setShowProfile(false);
    setSelectedUserId(null);
    setShowArticle(false);
    setSelectedArticleId(null);
    setActiveTab('post');
    setShowMobileMenu(false);
    updateURL(undefined, postId);
  };

  // ADDED: Handle article navigation
  const handleArticleClick = (articleId: string) => {
    console.log('📰 Navigating to article:', articleId);
    setSelectedArticleId(articleId);
    setShowArticle(true);
    setShowProfile(false);
    setSelectedUserId(null);
    setShowPostDetail(false);
    setSelectedPostId(null);
    setActiveTab('article');
    setShowMobileMenu(false);
    updateURL(undefined, undefined, articleId);
  };

  // Go back to previous view
  const backToPreviousView = () => {
    setShowProfile(false);
    setSelectedUserId(null);
    setShowPostDetail(false);
    setSelectedPostId(null);
    setShowArticle(false);
    setSelectedArticleId(null);
    // Go back to home
    setActiveTab('home');
    updateURL();
  };

  // Show loading while Firebase auth is initializing
  if (!authInitialized || loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading Patr...</p>
        </div>
      </div>
    );
  }

  // Show login only after auth has been checked and user is definitely not logged in
  if (!user) {
    return <Login />;
  }

  const renderContent = () => {
    // ADDED: If showing article, render article viewer
    if (showArticle && selectedArticleId) {
      return (
        <ArticleViewer 
          articleId={selectedArticleId}
          onBack={backToPreviousView}
        />
      );
    }

    // If showing post detail, render post detail component
    if (showPostDetail && selectedPostId) {
      return (
        <PostDetail 
          postId={selectedPostId}
          onBack={backToPreviousView}
        />
      );
    }

    // If showing profile, render profile component
    if (showProfile && selectedUserId) {
      return (
        <Profile 
          userId={selectedUserId}
          onBack={backToPreviousView}
          onArticleClick={handleArticleClick}
        />
      );
    }

    switch (activeTab) {
      case 'home':
        return <Feed type="home" showCompose={!isMobile} onUserClick={handleUserClick} onPostClick={handlePostClick} />;
      case 'explore':
        return <Feed type="explore" showCompose={false} onUserClick={handleUserClick} onPostClick={handlePostClick} />;
      case 'profile':
        return (
          <Profile 
            userId={user?.id}
            onBack={backToPreviousView}
            onArticleClick={handleArticleClick}
          />
        );
      case 'notifications':
        return (
          <div className="flex-1 border-r border-gray-800 p-8 text-center">
            <div className="text-6xl mb-4">🔔</div>
            <h2 className="text-2xl font-bold text-white mb-2">Notifications</h2>
            <p className="text-gray-400">Coming soon...</p>
          </div>
        );
      case 'messages':
        return (
          <div className="flex-1 border-r border-gray-800 p-8 text-center">
            <div className="text-6xl mb-4">💬</div>
            <h2 className="text-2xl font-bold text-white mb-2">Messages</h2>
            <p className="text-gray-400">Coming soon...</p>
          </div>
        );
      case 'bookmarks':
        return (
          <div className="flex-1 border-r border-gray-800 p-8 text-center">
            <div className="text-6xl mb-4">📖</div>
            <h2 className="text-2xl font-bold text-white mb-2">Bookmarks</h2>
            <p className="text-gray-400">Coming soon...</p>
          </div>
        );
      case 'settings':
        return (
          <div className="flex-1 border-r border-gray-800 p-8 text-center">
            <div className="text-6xl mb-4">⚙️</div>
            <h2 className="text-2xl font-bold text-white mb-2">Settings</h2>
            <p className="text-gray-400">Coming soon...</p>
          </div>
        );
      default:
        return <Feed type="home" showCompose={!isMobile} onUserClick={handleUserClick} onPostClick={handlePostClick} />;
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto flex relative">
        {/* Mobile Header */}
        {isMobile && (
          <div className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-xl border-b border-gray-800 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setShowMobileMenu(!showMobileMenu)}
                  className="p-2 rounded-full hover:bg-gray-800 transition-colors lg:hidden"
                >
                  {showMobileMenu ? (
                    <X className="w-6 h-6 text-white" />
                  ) : (
                    <Menu className="w-6 h-6 text-white" />
                  )}
                </button>
                
                <div className="flex items-center space-x-2">
                  <div className="w-7 h-7 bg-blue-500 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                    </svg>
                  </div>
                  <span className="font-bold text-white">Patr</span>
                </div>
              </div>

              <button
                onClick={() => setShowComposeModal(true)}
                className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-4 py-2 rounded-full transition-colors"
              >
                Post
              </button>
            </div>
          </div>
        )}

        {/* Mobile Navigation Drawer */}
        {isMobile && showMobileMenu && (
          <>
            <div 
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
              onClick={() => setShowMobileMenu(false)}
            />
            <div className="fixed left-0 top-0 bottom-0 w-80 bg-black border-r border-gray-800 z-50 lg:hidden overflow-y-auto">
              <div className="pt-16">
                <Sidebar activeTab={activeTab} onTabChange={handleTabChange} />
              </div>
            </div>
          </>
        )}
        
        {/* Desktop Sidebar */}
        {!isMobile && (
          <div className="w-64 flex-shrink-0">
            <Sidebar activeTab={activeTab} onTabChange={handleTabChange} />
          </div>
        )}
        
        {/* Main content */}
        <div className={`flex-1 flex ${isMobile ? 'pt-16' : ''}`}>
          {renderContent()}
          
          {/* Right sidebar - hidden on mobile, pass user click handler */}
          {!isMobile && (
            <RightSidebar onUserClick={handleUserClick} />
          )}
        </div>
      </div>

      {/* Mobile Floating Action Button for Compose */}
      {isMobile && !showComposeModal && activeTab === 'home' && !showProfile && !showPostDetail && !showArticle && (
        <button
          onClick={() => setShowComposeModal(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center z-40 transition-all duration-200 hover:scale-105 active:scale-95"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </button>
      )}

      {/* Compose modal */}
      {showComposeModal && (
        <>
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowComposeModal(false)}
          >
            <div 
              className="bg-black border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Compose post</h2>
                <button
                  onClick={() => setShowComposeModal(false)}
                  className="p-2 rounded-full hover:bg-gray-900 transition-colors"
                >
                  <X className="w-6 h-6 text-gray-400" />
                </button>
              </div>
              <ComposePost
                onPostCreated={() => {
                  setShowComposeModal(false);
                  setActiveTab('home');
                  setShowProfile(false);
                  setShowPostDetail(false);
                  setShowArticle(false);
                }}
                autoFocus
              />
            </div>
          </div>
        </>
      )}

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <div className="fixed bottom-0 left-0 right-0 bg-black border-t border-gray-800 z-40">
          <div className="flex items-center justify-around py-2">
            <button
              onClick={() => handleTabChange('home')}
              className={`flex flex-col items-center justify-center p-3 rounded-lg transition-colors ${
                activeTab === 'home' && !showProfile && !showPostDetail && !showArticle ? 'text-blue-400' : 'text-gray-400'
              }`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m3 12 2-2m0 0 7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span className="text-xs mt-1">Home</span>
            </button>
            
            <button
              onClick={() => handleTabChange('explore')}
              className={`flex flex-col items-center justify-center p-3 rounded-lg transition-colors ${
                activeTab === 'explore' ? 'text-blue-400' : 'text-gray-400'
              }`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607z" />
              </svg>
              <span className="text-xs mt-1">Explore</span>
            </button>
            
            <button
              onClick={() => handleTabChange('notifications')}
              className={`flex flex-col items-center justify-center p-3 rounded-lg transition-colors ${
                activeTab === 'notifications' ? 'text-blue-400' : 'text-gray-400'
              }`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1.586a1 1 0 01.707.293l2.414 2.414a1 1 0 00.707.293H15M9 10V9a3 3 0 116 0v1M9 10v5a2 2 0 002 2h2a2 2 0 002-2v-5m-6 0h6" />
              </svg>
              <span className="text-xs mt-1">Notifications</span>
            </button>
            
            <button
              onClick={() => handleTabChange('profile')}
              className={`flex flex-col items-center justify-center p-3 rounded-lg transition-colors ${
                activeTab === 'profile' || (showProfile && !showPostDetail && !showArticle) ? 'text-blue-400' : 'text-gray-400'
              }`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="text-xs mt-1">Profile</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </AuthProvider>
  );
};

export default App;