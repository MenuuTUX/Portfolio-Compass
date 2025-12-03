import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function DELETE() {
    try {
        // Delete all portfolio items
        const result = await prisma.portfolioItem.deleteMany({});

        return NextResponse.json({
            message: 'Portfolio cleared successfully',
            count: result.count
        });
    } catch (error) {
        console.error('Error clearing portfolio:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
