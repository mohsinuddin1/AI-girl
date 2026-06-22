import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
    try {
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
        const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

        // We must use the SERVICE_ROLE_KEY to bypass RLS for admin deletion
        const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

        // 1. Find all reports older than 10 days that still have a storage path
        const tenDaysAgo = new Date();
        tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

        const { data: oldReports, error: fetchError } = await supabase
            .from('medical_reports')
            .select('id, file_storage_path')
            .not('file_storage_path', 'is', null)
            .lt('created_at', tenDaysAgo.toISOString())
            .limit(100); // Process in batches of 100

        if (fetchError) throw fetchError;
        if (!oldReports || oldReports.length === 0) {
            return new Response("No old files to clean up.", { status: 200 })
        }

        // 2. Extract the file paths to delete
        const filesToDelete = oldReports.map(report => report.file_storage_path);

        // 3. Delete physical files securely via the Storage API!
        const { error: storageError } = await supabase.storage
            .from('medical-uploads')
            .remove(filesToDelete);

        if (storageError) throw storageError;

        // 4. Null out the paths in the database so we don't try to delete them again
        const reportIds = oldReports.map(r => r.id);
        const { error: dbError } = await supabase
            .from('medical_reports')
            .update({ file_storage_path: null })
            .in('id', reportIds);

        if (dbError) throw dbError;

        return new Response(`Successfully deleted ${filesToDelete.length} files.`, { status: 200 })
    } catch (error) {
        console.error(error)
        return new Response(`Error: ${error.message}`, { status: 500 })
    }
})
