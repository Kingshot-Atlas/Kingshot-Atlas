/**
 * Service for syncing user data across devices when authenticated
 * Handles favorites, recently viewed, and compare history
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { logger } from '../utils/logger';

const FAVORITES_KEY = 'kingshot_favorites';
const RECENTLY_VIEWED_KEY = 'kingshot_recently_viewed';
const COMPARE_HISTORY_KEY = 'kingshot_compare_history';

export interface UserData {
  favorites: number[];
  recently_viewed: number[];
  compare_history: { k1: number; k2: number }[];
}

class UserDataService {
  private userId: string | null = null;

  setUserId(userId: string | null) {
    this.userId = userId;
    if (userId) {
      this.syncFromCloud();
    }
  }

  // Get data from localStorage
  getLocalData(): UserData {
    try {
      return {
        favorites: JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]'),
        recently_viewed: JSON.parse(localStorage.getItem(RECENTLY_VIEWED_KEY) || '[]'),
        compare_history: JSON.parse(localStorage.getItem(COMPARE_HISTORY_KEY) || '[]')
      };
    } catch {
      return { favorites: [], recently_viewed: [], compare_history: [] };
    }
  }

  // Save data to localStorage
  saveLocalData(data: Partial<UserData>) {
    if (data.favorites !== undefined) {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(data.favorites));
    }
    if (data.recently_viewed !== undefined) {
      localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(data.recently_viewed));
    }
    if (data.compare_history !== undefined) {
      localStorage.setItem(COMPARE_HISTORY_KEY, JSON.stringify(data.compare_history));
    }
  }

  // Sync data from cloud to local (on login)
  async syncFromCloud(): Promise<void> {
    if (!this.userId || !isSupabaseConfigured || !supabase) return;

    try {
      const { data, error } = await supabase
        .from('user_data')
        .select('*')
        .eq('user_id', this.userId)
        .single();

      if (error && error.code === 'PGRST116') {
        // No cloud data exists, upload local data
        await this.syncToCloud();
        return;
      }

      if (data) {
        // Merge cloud data with local data (cloud takes precedence for favorites)
        const local = this.getLocalData();
        const merged: UserData = {
          favorites: data.favorites || local.favorites,
          recently_viewed: this.mergeArrays(data.recently_viewed || [], local.recently_viewed, 20),
          compare_history: data.compare_history || local.compare_history
        };
        this.saveLocalData(merged);
      }
    } catch (err) {
      logger.warn('Failed to sync from cloud:', err);
    }
  }

  // Sync data to cloud (on data change)
  async syncToCloud(): Promise<void> {
    if (!this.userId || !isSupabaseConfigured || !supabase) return;

    try {
      const local = this.getLocalData();
      
      await supabase
        .from('user_data')
        .upsert({
          user_id: this.userId,
          favorites: local.favorites,
          recently_viewed: local.recently_viewed,
          compare_history: local.compare_history,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
    } catch (err) {
      logger.warn('Failed to sync to cloud:', err);
    }
  }

  // Helper to merge arrays while keeping unique values
  private mergeArrays<T>(arr1: T[], arr2: T[], maxLength: number): T[] {
    const merged = [...new Set([...arr1, ...arr2])];
    return merged.slice(0, maxLength);
  }

  // Favorites operations with auto-sync
  async addFavorite(kingdomNumber: number): Promise<number[]> {
    const data = this.getLocalData();
    if (!data.favorites.includes(kingdomNumber)) {
      data.favorites.push(kingdomNumber);
      this.saveLocalData({ favorites: data.favorites });
      await this.syncToCloud();
    }
    return data.favorites;
  }

  async removeFavorite(kingdomNumber: number): Promise<number[]> {
    const data = this.getLocalData();
    data.favorites = data.favorites.filter(k => k !== kingdomNumber);
    this.saveLocalData({ favorites: data.favorites });
    await this.syncToCloud();
    return data.favorites;
  }

  async toggleFavorite(kingdomNumber: number): Promise<{ favorites: number[]; added: boolean }> {
    const data = this.getLocalData();
    const isCurrentlyFavorite = data.favorites.includes(kingdomNumber);
    
    if (isCurrentlyFavorite) {
      await this.removeFavorite(kingdomNumber);
      return { favorites: this.getLocalData().favorites, added: false };
    } else {
      await this.addFavorite(kingdomNumber);
      return { favorites: this.getLocalData().favorites, added: true };
    }
  }

  // Recently viewed operations
  async addRecentlyViewed(kingdomNumber: number): Promise<void> {
    const data = this.getLocalData();
    data.recently_viewed = [kingdomNumber, ...data.recently_viewed.filter(k => k !== kingdomNumber)].slice(0, 20);
    this.saveLocalData({ recently_viewed: data.recently_viewed });
    // Don't sync recently viewed immediately, batch it
  }

  // Compare history operations
  async addCompareHistory(k1: number, k2: number): Promise<void> {
    const data = this.getLocalData();
    const exists = data.compare_history.some(h => 
      (h.k1 === k1 && h.k2 === k2) || (h.k1 === k2 && h.k2 === k1)
    );
    
    if (!exists) {
      data.compare_history = [{ k1, k2 }, ...data.compare_history].slice(0, 10);
      this.saveLocalData({ compare_history: data.compare_history });
      await this.syncToCloud();
    }
  }
}

export const userDataService = new UserDataService();
