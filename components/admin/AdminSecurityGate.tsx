'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Loader2 } from "lucide-react";

interface AdminSecurityGateProps {
    title: string;
    description: string;
    verifyFn: (password: string) => Promise<{ success: boolean; error?: string }>;
}

export default function AdminSecurityGate({ title, description, verifyFn }: AdminSecurityGateProps) {
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const result = await verifyFn(password);
            if (!result.success) {
                setError(result.error || 'Contrasenya incorrecta');
            }
        } catch (err) {
            setError('Error de connexió');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center p-8 bg-stone-50 rounded-3xl border-2 border-dashed border-stone-200 min-h-[400px]">
            <Card className="w-full max-w-md shadow-xl border-stone-200 bg-white">
                <CardHeader className="text-center space-y-2">
                    <div className="mx-auto w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mb-2">
                        <Lock className="w-6 h-6 text-amber-600" />
                    </div>
                    <CardTitle className="text-2xl font-serif">{title}</CardTitle>
                    <p className="text-sm text-stone-500">{description}</p>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleVerify} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="pass">Contrasenya Mestra</Label>
                            <Input
                                id="pass"
                                type="password"
                                placeholder="Introduïu la clau..."
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="bg-stone-50"
                            />
                        </div>
                        {error && <p className="text-red-500 text-xs font-bold">{error}</p>}
                        <Button
                            type="submit"
                            className="w-full bg-stone-800 hover:bg-stone-900 text-white"
                            disabled={isLoading}
                            data-testid="admin-gate-submit"
                        >
                            {isLoading ? <Loader2 className="animate-spin w-4 h-4" /> : "Accedir"}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
