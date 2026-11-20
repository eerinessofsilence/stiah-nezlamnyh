import ExpoModulesCore
import UIKit

public final class GuideEdgeBlurModule: Module {
  public func definition() -> ModuleDefinition {
    Name("GuideEdgeBlur")

    View(GuideEdgeBlurView.self) {
      Prop("materialTint") { (view: GuideEdgeBlurView, color: UIColor) in
        view.setMaterialTint(color)
      }
    }
  }
}

final class GuideEdgeBlurView: ExpoView {
  private let blur = UIVisualEffectView(effect: nil)
  private let fadeMask = UIView()
  private let blurGradient = CAGradientLayer()
  private let tintGradient = CAGradientLayer()
  private var animator: UIViewPropertyAnimator?

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)

    isUserInteractionEnabled = false
    accessibilityElementsHidden = true
    blurGradient.colors = [UIColor.black.cgColor, UIColor.black.cgColor, UIColor.clear.cgColor]
    blurGradient.locations = [0, 0.18, 1]
    fadeMask.layer.addSublayer(blurGradient)
    addSubview(blur)
    tintGradient.locations = blurGradient.locations
    layer.addSublayer(tintGradient)

    NotificationCenter.default.addObserver(
      self, selector: #selector(updateTransparency),
      name: UIAccessibility.reduceTransparencyStatusDidChangeNotification, object: nil
    )
    updateTransparency()
  }

  func setMaterialTint(_ color: UIColor) {
    let tint = color.withAlphaComponent(0.03).cgColor
    tintGradient.colors = [tint, tint, color.withAlphaComponent(0).cgColor]
  }

  @objc private func updateTransparency() {
    let reduceTransparency = UIAccessibility.isReduceTransparencyEnabled
    blur.isHidden = reduceTransparency
    tintGradient.isHidden = reduceTransparency
  }

  deinit {
    animator?.stopAnimation(true)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    blur.frame = bounds
    fadeMask.frame = bounds
    blurGradient.frame = fadeMask.bounds
    blur.mask = fadeMask
    tintGradient.frame = bounds

    if animator == nil && !bounds.isEmpty {
      let animator = UIViewPropertyAnimator(duration: 1, curve: .linear) { [weak self] in
        self?.blur.effect = UIBlurEffect(style: .systemUltraThinMaterial)
      }
      animator.fractionComplete = 0.12
      self.animator = animator
    }
  }
}
