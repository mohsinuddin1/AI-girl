import { supabase } from '../lib/supabase';

const TABLE_NAME = 'medical_reports';
const PAGE_SIZE = 20;

export const ReportService = {
    /**
     * Fetch the first page of medical reports for the current user.
     * Ordered by created_at descending (newest first).
     *
     * @param {string} userId
     * @returns {Promise<Array>}
     */
    async fetchReports(userId) {
        if (!supabase || !userId) return [];

        const { data, error } = await supabase
            .from(TABLE_NAME)
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(PAGE_SIZE);

        if (error) {
            console.error('[ReportService] fetchReports error:', error);
            throw error;
        }

        return data || [];
    },

    /**
     * Fetch more reports for infinite scroll (cursor-based pagination).
     *
     * @param {string} userId
     * @param {string} lastCreatedAt - ISO timestamp of the last loaded report
     * @returns {Promise<Array>}
     */
    async fetchMoreReports(userId, lastCreatedAt) {
        if (!supabase || !userId || !lastCreatedAt) return [];

        const { data, error } = await supabase
            .from(TABLE_NAME)
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .lt('created_at', lastCreatedAt)
            .limit(PAGE_SIZE);

        if (error) {
            console.error('[ReportService] fetchMoreReports error:', error);
            throw error;
        }

        return data || [];
    },

    /**
     * Get a single report by ID.
     *
     * @param {string} reportId
     * @returns {Promise<Object|null>}
     */
    async getReport(reportId) {
        if (!supabase || !reportId) return null;

        const { data, error } = await supabase
            .from(TABLE_NAME)
            .select('*')
            .eq('id', reportId)
            .single();

        if (error) {
            console.error('[ReportService] getReport error:', error);
            throw error;
        }

        return data;
    },

    /**
     * Rename a report (update title).
     *
     * @param {string} reportId
     * @param {string} newTitle
     * @returns {Promise<Object>}
     */
    async renameReport(reportId, newTitle) {
        if (!supabase || !reportId) throw new Error('Invalid report');

        const { data, error } = await supabase
            .from(TABLE_NAME)
            .update({ title: newTitle.trim() })
            .eq('id', reportId)
            .select()
            .single();

        if (error) {
            console.error('[ReportService] renameReport error:', error);
            throw error;
        }

        return data;
    },

    /**
     * Update a report's content (summary, key_findings, etc.).
     *
     * @param {string} reportId
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>}
     */
    async updateReport(reportId, updates) {
        if (!supabase || !reportId) throw new Error('Invalid report');

        // Only allow safe fields to be updated
        const allowedFields = ['title', 'summary', 'key_findings', 'conditions_discussed', 'recommended_followups'];
        const safeUpdates = {};
        for (const key of allowedFields) {
            if (updates[key] !== undefined) {
                safeUpdates[key] = updates[key];
            }
        }

        const { data, error } = await supabase
            .from(TABLE_NAME)
            .update(safeUpdates)
            .eq('id', reportId)
            .select()
            .single();

        if (error) {
            console.error('[ReportService] updateReport error:', error);
            throw error;
        }

        return data;
    },

    /**
     * Delete a report.
     *
     * @param {string} reportId
     * @returns {Promise<void>}
     */
    async deleteReport(reportId) {
        if (!supabase || !reportId) throw new Error('Invalid report');

        const { error } = await supabase
            .from(TABLE_NAME)
            .delete()
            .eq('id', reportId);

        if (error) {
            console.error('[ReportService] deleteReport error:', error);
            throw error;
        }
    },
};
