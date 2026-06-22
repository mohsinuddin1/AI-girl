import { Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

// Guideline sizes are based on standard ~5" screen mobile device (e.g. iPhone 14 Pro length)
const guidelineBaseWidth = 393;
const guidelineBaseHeight = 852;

/**
 * scale(size): Scales width/horizontal margins/padding proportionally based on the device's width.
 */
const scale = (size) => (width / guidelineBaseWidth) * size;

/**
 * verticalScale(size): Scales height/vertical margins/padding proportionally based on the device's height.
 */
const verticalScale = (size) => (height / guidelineBaseHeight) * size;

/**
 * moderateScale(size, factor=0.5): Scales fonts/icons proportionally but applies a 'brake' (factor) 
 * so it doesn't shrink to an unreadable size on small phones or become comically massive on iPads.
 */
const moderateScale = (size, factor = 0.5) => size + (scale(size) - size) * factor;

/**
 * moderateVerticalScale(size, factor=0.5): Same as moderateScale but for vertical constraints.
 */
const moderateVerticalScale = (size, factor = 0.5) => size + (verticalScale(size) - size) * factor;

export { scale, verticalScale, moderateScale, moderateVerticalScale, width, height };
