/**
 * Design-system barrel. Feature code imports from `@/components/ui`, never
 * from a file inside it, so a primitive can be split or renamed without a
 * cross-repo rename.
 */

export {Text, type TextProps, type TextVariant, type TextColor} from './Text';
export {Screen, type ScreenProps} from './screen';
export {Button, type ButtonProps, type ButtonVariant, type ButtonSize} from './Button';
export {Price, type PriceProps, type PriceSize} from './Price';
export {Card, type CardProps} from './Card';
export {Divider, type DividerProps} from './Divider';
export {Badge, type BadgeProps, type BadgeTone} from './Badge';
export {Skeleton, SkeletonText, type SkeletonProps} from './Skeleton';
export {Sheet, type SheetProps} from './Sheet';
export {EmptyState, type EmptyStateProps} from './EmptyState';
export {
    ProductCard,
    ProductCardSkeleton,
    type ProductCardProps,
    type ProductCardData,
} from './ProductCard';
export {Stepper, type StepperProps} from './Stepper';
export {IconSymbol, type IconSymbolProps, type IconName} from './IconSymbol';
export {ThemeToggle} from './ThemeToggle';

export {formatPrice, discountPercent, toMajorUnits} from '@/design/format-price';
