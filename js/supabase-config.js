import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// En sitios estáticos sin compilador, las claves públicas se ponen directamente
const supabaseUrl = 'https://ngijkdtkkaogsqhyysha.supabase.co';
const supabaseKey = 'sb_publishable_v_KolOKfHAThJA4k7Z0rNw_-jsihSmB';

export const supabase = createClient(supabaseUrl, supabaseKey);
