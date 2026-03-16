import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { createBrowserClient } from '@/lib/supabase/client';
import type { BusinessType } from '@/types/vertical';

export function useOrgBusinessType() {
    const { organizationId } = useAuth();
    const [businessType, setBusinessType] = useState<BusinessType | undefined>();
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        if (!organizationId) {
            setIsLoading(false);
            return;
        }

        const fetchBusinessType = async () => {
            setIsLoading(true);
            try {
                const supabase = createBrowserClient();
                const { data } = await supabase
                    .from('organizations')
                    .select('business_type')
                    .eq('id', organizationId)
                    .single();

                if (isMounted && data?.business_type) {
                    setBusinessType(data.business_type as BusinessType);
                }
            } catch (error) {
                console.error('Failed to fetch business_type:', error);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        fetchBusinessType();

        return () => {
            isMounted = false;
        };
    }, [organizationId]);

    return { businessType, isLoading };
}
