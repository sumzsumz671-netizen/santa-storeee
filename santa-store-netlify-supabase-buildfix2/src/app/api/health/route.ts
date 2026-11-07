import { NextResponse } from "next/server";
export async function GET(){return NextResponse.json({status:"ok",service:"santa-store",timestamp:new Date().toISOString()});}
