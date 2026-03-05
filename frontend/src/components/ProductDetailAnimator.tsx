"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

export function ProductImageAnimator({ children }: { children: ReactNode }) {
  return (
    <motion.div 
      initial={{ opacity: 0, x: -30 }} 
      animate={{ opacity: 1, x: 0 }} 
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="w-full h-full flex items-center justify-center relative"
    >
      {children}
    </motion.div>
  );
}

export function ProductInfoAnimator({ children }: { children: ReactNode }) {
  return (
    <motion.div 
      initial={{ opacity: 0, x: 30 }} 
      animate={{ opacity: 1, x: 0 }} 
      transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
      className="w-full flex flex-col justify-center h-full"
    >
      {children}
    </motion.div>
  );
}