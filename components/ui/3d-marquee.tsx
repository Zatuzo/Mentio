'use client';
import { motion } from 'framer-motion'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
function cn(...inputs: any[]) { return twMerge(clsx(inputs)) }

interface ThreeDMarqueeProps {
  images?: string[]
  className?: string
}

const defaultImages = [
  'https://pyengguphcmeqlelpozr.supabase.co/storage/v1/object/public/images/becane.webp',
  'https://pyengguphcmeqlelpozr.supabase.co/storage/v1/object/public/images/chdartmaker--1-.webp',
  'https://pyengguphcmeqlelpozr.supabase.co/storage/v1/object/public/images/www-instituteofhealth-com-.webp',
  'https://pyengguphcmeqlelpozr.supabase.co/storage/v1/object/public/images/wadeandleta-com-.webp',
  'https://pyengguphcmeqlelpozr.supabase.co/storage/v1/object/public/images/felixpeault.webp',
  'https://pyengguphcmeqlelpozr.supabase.co/storage/v1/object/public/images/1820productions.webp',
  'https://pyengguphcmeqlelpozr.supabase.co/storage/v1/object/public/images/emilie.webp',
  'https://pyengguphcmeqlelpozr.supabase.co/storage/v1/object/public/images/telhaclarke.webp',
  'https://pyengguphcmeqlelpozr.supabase.co/storage/v1/object/public/images/jonasreymondin.webp',
  'https://pyengguphcmeqlelpozr.supabase.co/storage/v1/object/public/images/www-anima-ai.webp',
  'https://pyengguphcmeqlelpozr.supabase.co/storage/v1/object/public/images/dulcedo-com-.webp',
  'https://pyengguphcmeqlelpozr.supabase.co/storage/v1/object/public/images/15thplus.webp',
]

const ThreeDMarquee = ({
  images = defaultImages,
  className,
}: ThreeDMarqueeProps) => {
  const chunkSize = Math.ceil(images.length / 3)
  const chunks = Array.from({ length: 3 }, (_, colIndex) => {
    const start = colIndex * chunkSize
    return images.slice(start, start + chunkSize)
  })

  return (
    <div
      className={cn(
        'mx-auto block h-[35rem] w-full overflow-hidden rounded-md max-xl:h-[30rem] max-sm:h-[25rem]',
        className
      )}
    >
      <div className='flex size-full items-center justify-center'>
        {/* size-full keeps the stage container-relative so the rotated grid
            fully fills its frame (incl. corners) at every breakpoint. */}
        <div className='size-full shrink-0 scale-[1.9]'>
          <div
            style={{ transform: 'rotateX(45deg) rotateY(0deg) rotateZ(45deg)', transformStyle: 'preserve-3d' }}
            className='relative top-8 right-[-40%] grid size-full origin-top-left grid-cols-3 gap-5 max-sm:gap-3'
          >
            {chunks.map((subarray, colIndex) => (
              <motion.figure
                animate={{ y: colIndex % 2 === 0 ? 60 : -60 }}
                transition={{
                  duration: colIndex % 2 === 0 ? 10 : 15,
                  repeat: Infinity,
                  repeatType: 'reverse',
                }}
                key={colIndex + 'marquee'}
                className='flex flex-col items-start gap-6 max-sm:gap-3'
              >
                {subarray.map((src, imageIndex) => (
                  <div className='relative' key={imageIndex + src}>
                    <img
                      className='aspect-[4/3] h-full w-full rounded-lg bg-neutral-100 object-cover object-top select-none dark:bg-neutral-900'
                      key={imageIndex}
                      src={src}
                      draggable={false}
                      alt={`Image ${imageIndex + 1}`}
                    />
                  </div>
                ))}
              </motion.figure>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ThreeDMarquee
