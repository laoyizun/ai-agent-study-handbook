// Supabase 客户端封装
// 使用新版 publishable key + Supabase JS CDN
// 加载方式：在 HTML 末尾加 <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

(function () {
  'use strict';

  const SUPABASE_URL = 'https://rwdadlbtvjuoonnbbriy.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_JgjEFVnjeZPwzn9kO-2qCg_TpE6rIhB';

  // 等待 supabase-js 加载
  function getClient() {
    if (!window.supabase) {
      throw new Error('Supabase JS 未加载');
    }
    if (!window.__sbClient) {
      window.__sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
    return window.__sbClient;
  }

  // 公开 API
  window.SB = {
    // ============ 学生 ============
    async listStudents() {
      const c = getClient();
      const { data, error } = await c.from('students').select('*').order('name');
      if (error) throw error;
      return data;
    },
    async upsertStudent(name) {
      const c = getClient();
      const { data, error } = await c.from('students').upsert({ name }, { onConflict: 'name' }).select();
      if (error) throw error;
      return data?.[0];
    },

    // ============ 卡片 ============
    async listCards(studentName) {
      const c = getClient();
      let q = c.from('cards').select('*').order('created_at', { ascending: false });
      if (studentName) q = q.eq('student_name', studentName);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    async addCard(studentName, subject, question, answer) {
      const c = getClient();
      const { data, error } = await c.from('cards').insert({
        student_name: studentName,
        subject, question, answer
      }).select();
      if (error) throw error;
      return data?.[0];
    },
    async updateCard(id, fields) {
      const c = getClient();
      const { data, error } = await c.from('cards').update(fields).eq('id', id).select();
      if (error) throw error;
      return data?.[0];
    },
    async deleteCard(id) {
      const c = getClient();
      const { error } = await c.from('cards').delete().eq('id', id);
      if (error) throw error;
      return true;
    },

    // ============ 复习记录 ============
    async listReviews(cardId) {
      const c = getClient();
      let q = c.from('reviews').select('*').order('reviewed_at', { ascending: false });
      if (cardId) q = q.eq('card_id', cardId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    async addReview(cardId, mark) {
      const c = getClient();
      const { data, error } = await c.from('reviews').insert({ card_id: cardId, mark }).select();
      if (error) throw error;
      return data?.[0];
    },

    // ============ 统计 ============
    async getStats(studentName) {
      const cards = await this.listCards(studentName);
      const ids = cards.map(c => c.id);
      if (ids.length === 0) return { total: 0, done: 0, half: 0, bad: 0 };
      const reviews = await this.listReviews();
      const mine = reviews.filter(r => ids.includes(r.card_id));
      // 只算每张卡最近一次
      const latest = {};
      mine.forEach(r => {
        if (!latest[r.card_id] || new Date(r.reviewed_at) > new Date(latest[r.card_id].reviewed_at)) {
          latest[r.card_id] = r;
        }
      });
      const stats = { total: cards.length, done: 0, half: 0, bad: 0 };
      Object.values(latest).forEach(r => {
        if (r.mark === 'done') stats.done++;
        else if (r.mark === 'half') stats.half++;
        else if (r.mark === 'bad') stats.bad++;
      });
      return stats;
    },

    // ============ 工具 ============
    isReady() {
      return !!window.supabase;
    }
  };
})();