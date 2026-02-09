import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useToast } from '../components/Toast';
import { userDataService } from '../services/userDataService';
import { STORAGE_KEYS } from '../constants';
import { incrementStat } from '../components/UserAchievements';

interface FavoritesContextType {
  favorites: number[];
  toggleFavorite: (kingdomNumber: number) => void;
  isFavorite: (kingdomNumber: number) => boolean;
  favoritesCount: number;
}

const FavoritesContext = createContext<FavoritesContextType | null>(null);

export const useFavoritesContext = () => {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error('useFavoritesContext must be used within a FavoritesProvider');
  }
  return context;
};

export const FavoritesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  // Register sync error handler for user notification (centralized)
  useEffect(() => {
    userDataService.onSyncError((msg) => showToast(msg, 'error'));
    return () => userDataService.onSyncError(() => {});
  }, [showToast]);

  // Initialize from localStorage (fast, synchronous)
  const [favorites, setFavorites] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.FAVORITES);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Persist to localStorage + Supabase whenever favorites change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favorites));
    userDataService.syncToCloud();
  }, [favorites]);

  // Re-hydrate from Supabase after login (cloud is source of truth for logged-in users)
  useEffect(() => {
    if (user) {
      // Give syncFromCloud time to update localStorage, then read it
      const timer = setTimeout(() => {
        try {
          const saved = localStorage.getItem(STORAGE_KEYS.FAVORITES);
          const cloudFavorites: number[] = saved ? JSON.parse(saved) : [];
          setFavorites(prev => {
            if (JSON.stringify(prev) !== JSON.stringify(cloudFavorites)) {
              return cloudFavorites;
            }
            return prev;
          });
        } catch {
          // ignore parse errors
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [user]);

  const toggleFavorite = useCallback((kingdomNumber: number) => {
    setFavorites(prev => {
      const isFav = prev.includes(kingdomNumber);
      if (!isFav) {
        incrementStat('favoritesSaved');
      }
      return isFav
        ? prev.filter(k => k !== kingdomNumber)
        : [...prev, kingdomNumber];
    });
  }, []);

  const isFavorite = useCallback((kingdomNumber: number) => {
    return favorites.includes(kingdomNumber);
  }, [favorites]);

  const value: FavoritesContextType = {
    favorites,
    toggleFavorite,
    isFavorite,
    favoritesCount: favorites.length,
  };

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
};
